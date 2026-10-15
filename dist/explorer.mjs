import {CATEGORIES, money, preciseMoney, compact, escapeHTML as e} from './core.mjs';

const KINDS = ['account', 'category', 'merchant'];
const NODE_LIMITS = {account: 5, category: 7, merchant: 8};
const QUESTION_LABELS = {purchases: 'Largest purchase categories', recurring: 'Possible recurring merchants', review: 'Payments that need review'};
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const count = value => Number(value).toLocaleString('en-IN');
const directionOf = value => value === 'credit' ? 'credit' : 'debit';
const amountOf = (t, direction) => Number.isFinite(t?.[direction]) && t[direction] > 0 ? t[direction] : 0;
const typeOf = t => t.account === 'card' ? 'card' : t.account === 'bank' ? 'bank' : 'unknown';
const typeLabel = type => type === 'card' ? 'Credit card' : type === 'bank' ? 'Bank account' : 'Unspecified account';
const accountLabel = t => String(t.accountKey || 'Unlabelled account');
export const explorerAccountKey = t => JSON.stringify([typeOf(t), accountLabel(t)]);
const categoryOf = t => String(t.category || 'Uncategorized');
const merchantOf = t => String(t.merchant || 'Unidentified counterparty');
const statusOf = t => t.review ? 'Needs review' : t.classification === 'Edited' ? 'Edited' : 'Suggested';
const nodeId = (kind, key) => JSON.stringify([kind, key]);
const keyOf = (t, kind) => kind === 'account' ? explorerAccountKey(t) : kind === 'category' ? categoryOf(t) : merchantOf(t);
const totalOf = (rows, direction) => round(rows.reduce((total, t) => total + amountOf(t, direction), 0));
const plural = (n, singular, multiple = singular + 's') => `${count(n)} ${n === 1 ? singular : multiple}`;

export function searchExplorerRows(transactions, query = '', direction = 'debit') {
  const field = directionOf(direction), needle = String(query || '').trim().toLocaleLowerCase();
  return transactions.filter(t => amountOf(t, field) > 0 && (!needle || [accountLabel(t), typeLabel(typeOf(t)), categoryOf(t), merchantOf(t), t.description, t.source].join(' ').toLocaleLowerCase().includes(needle)));
}

// A repeated merchant is a candidate, not proof of a subscription or commitment.
export function recurringExplorerMerchants(transactions, direction = 'debit') {
  const field = directionOf(direction), groups = new Map();
  for (const t of transactions) {
    if (!amountOf(t, field) || t.review || !CATEGORIES[t.category]?.expense) continue;
    const key = merchantOf(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups].map(([key, rows]) => {
    const months = [...new Set(rows.map(t => String(t.date || '').slice(0, 7)).filter(date => /^\d{4}-\d{2}$/.test(date)))].sort();
    const values = rows.map(t => amountOf(t, field)).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    const consistency = values.filter(value => Math.abs(value - median) <= median * 0.15).length / values.length;
    return {key, count: rows.length, months: months.length, total: totalOf(rows, field), median: round(median), consistency, transactionIds: rows.map(t => t.id)};
  }).filter(group => group.months >= 3 && group.consistency >= 0.65)
    .sort((a, b) => b.months - a.months || b.total - a.total || a.key.localeCompare(b.key));
}

export function selectExplorerRows(transactions, selection = null, direction = 'debit') {
  const field = directionOf(direction), rows = transactions.filter(t => amountOf(t, field) > 0);
  if (!selection) return rows;
  if (KINDS.includes(selection.kind)) return rows.filter(t => keyOf(t, selection.kind) === selection.key);
  if (selection.kind !== 'question') return [];
  if (selection.key === 'purchases') return rows.filter(t => CATEGORIES[t.category]?.expense);
  if (selection.key === 'review') return rows.filter(t => t.review);
  if (selection.key === 'recurring') {
    const keys = new Set(recurringExplorerMerchants(rows, field).map(group => group.key));
    return rows.filter(t => keys.has(merchantOf(t)) && !t.review && CATEGORIES[t.category]?.expense);
  }
  return [];
}

export function explorerInsights(transactions, direction = 'debit') {
  const field = directionOf(direction), rows = searchExplorerRows(transactions, '', field);
  const purchases = rows.filter(t => CATEGORIES[t.category]?.expense), review = rows.filter(t => t.review);
  const categories = new Map();
  for (const t of purchases) categories.set(categoryOf(t), (categories.get(categoryOf(t)) || 0) + amountOf(t, field));
  const largestCategory = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {direction: field, total: totalOf(rows, field), count: rows.length,
    bankTotal: totalOf(rows.filter(t => typeOf(t) === 'bank'), field), cardTotal: totalOf(rows.filter(t => typeOf(t) === 'card'), field),
    purchaseTotal: totalOf(purchases, field), purchaseCount: purchases.length,
    reviewTotal: totalOf(review, field), reviewCount: review.length,
    largestCategory: largestCategory ? {key: largestCategory[0], total: round(largestCategory[1])} : null,
    recurring: recurringExplorerMerchants(rows, field)};
}

/** Full, uncapped graph. Each relationship retains its supporting transaction IDs. */
export function buildGraph(transactions, {direction = 'debit', query = ''} = {}) {
  const field = directionOf(direction), rows = searchExplorerRows(transactions, query, field);
  const nodes = new Map(), links = new Map();
  for (const t of rows) {
    const status = statusOf(t), amount = amountOf(t, field), ids = [];
    for (const kind of KINDS) {
      const key = keyOf(t, kind), id = nodeId(kind, key);
      ids.push(id);
      if (!nodes.has(id)) nodes.set(id, {id, kind, key, label: kind === 'account' ? accountLabel(t) : key,
        ...(kind === 'account' ? {accountType: typeOf(t), accountTypeLabel: typeLabel(typeOf(t))} : {}),
        amount: 0, count: 0, statuses: {'Suggested': 0, 'Edited': 0, 'Needs review': 0}, transactionIds: []});
      const node = nodes.get(id);
      node.amount += amount; node.count++; node.statuses[status]++; node.transactionIds.push(t.id);
    }
    for (let i = 0; i < 2; i++) {
      const id = JSON.stringify([ids[i], ids[i + 1]]);
      if (!links.has(id)) links.set(id, {id, source: ids[i], target: ids[i + 1], relation: i === 0 ? 'categorized_as' : 'paid_to_or_received_from', amount: 0, count: 0, transactionIds: []});
      const link = links.get(id); link.amount += amount; link.count++; link.transactionIds.push(t.id);
    }
  }
  return {schemaVersion: 1, currency: 'INR', direction: field, query: String(query || '').trim(),
    meaning: 'Statement accounts grouped by category and merchant/counterparty. Categories and merchant labels are narration-based suggestions unless edited. Links do not establish ownership, intent, or matched transfers. Bank and card activity may include both a card bill payment and its purchases.',
    totalAmount: totalOf(rows, field), transactionCount: rows.length,
    nodes: [...nodes.values()].map(node => ({...node, amount: round(node.amount)})).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.amount - a.amount || a.label.localeCompare(b.label)),
    links: [...links.values()].map(link => ({...link, amount: round(link.amount)})).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id)),
    evidence: rows.map(t => ({transactionId: t.id, date: t.date, amount: amountOf(t, field), direction: field,
      accountType: typeOf(t), accountLabel: accountLabel(t), category: categoryOf(t), merchant: merchantOf(t),
      status: statusOf(t), reason: t.reason || '', description: t.description || '', source: t.source || 'Source unavailable', sourceId: t.sourceId || null, sourceRow: t.row ?? null, sourcePage:t.sourcePage??null, extractedWithOCR:!!t.extractedWithOCR}))};
}

function visibleGraph(graph, selection) {
  const columns = KINDS.map(kind => {
    const all = graph.nodes.filter(node => node.kind === kind), shown = all.slice(0, NODE_LIMITS[kind]);
    if (selection?.kind === kind) {
      const selected = all.find(node => node.key === selection.key);
      if (selected && !shown.includes(selected)) shown[shown.length - 1] = selected;
    }
    return {kind, all, shown, hidden: all.length - shown.length};
  });
  const ids = new Set(columns.flatMap(column => column.shown.map(node => node.id)));
  const links = graph.links.filter(link => ids.has(link.source) && ids.has(link.target));
  const paths = graph.evidence.filter(t => ids.has(nodeId('account', JSON.stringify([t.accountType, t.accountLabel]))) && ids.has(nodeId('category', t.category)) && ids.has(nodeId('merchant', t.merchant)));
  return {columns, links, paths, hidden: columns.reduce((total, column) => total + column.hidden, 0)};
}

function nodeStatus(node) {
  if (node.statuses['Needs review']) return {label: `${count(node.statuses['Needs review'])} to review`, className: 'review'};
  if (node.statuses.Suggested) return {label: 'Suggested', className: 'suggested'};
  return {label: 'Edited', className: 'edited'};
}

function renderMap(graph, selection) {
  if (!graph.transactionCount) return '<div class="ex-empty"><span class="ex-empty-mark" aria-hidden="true">⌁</span><h3>No connections in this view.</h3><p>Try another direction, clear your search, or import a statement to begin.</p></div>';
  const visible = visibleGraph(graph, selection), maxRows = Math.max(...visible.columns.map(column => column.shown.length));
  const height = Math.max(250, maxRows * 76 + 16), width = 960, lefts = [0, 364, 728], nodeWidth = 232;
  const locations = new Map();
  visible.columns.forEach((column, col) => column.shown.forEach((node, index) => locations.set(node.id, {x: lefts[col], y: 8 + (height - 16) * (index + .5) / column.shown.length})));
  const selectedNode = graph.nodes.find(node => node.kind === selection?.kind && node.key === selection?.key);
  const relevantIds = selectedNode ? new Set(selectedNode.transactionIds) : null;
  const maxAmount = Math.max(1, ...visible.links.map(link => link.amount));
  const pathHTML = visible.links.map(link => {
    const from = locations.get(link.source), to = locations.get(link.target), relevant = !relevantIds || link.transactionIds.some(id => relevantIds.has(id));
    return `<path class="ex-edge ${selectedNode ? relevant ? 'is-related' : 'is-muted' : ''}" d="M${from.x + nodeWidth},${from.y} C${from.x + nodeWidth + 61},${from.y} ${to.x - 61},${to.y} ${to.x},${to.y}" stroke-width="${(1.5 + 12 * Math.sqrt(link.amount / maxAmount)).toFixed(2)}"><title>${e(graph.nodes.find(n => n.id === link.source)?.label)} → ${e(graph.nodes.find(n => n.id === link.target)?.label)}: ${e(preciseMoney(link.amount))}, ${plural(link.count, 'transaction')}</title></path>`;
  }).join('');
  const columnNames = {account: 'Statement account', category: 'Suggested purpose', merchant: 'Merchant / counterparty'};
  const selectedTitle = selectedNode ? ` · ${selectedNode.label} highlighted` : '';
  return `<div class="ex-map-summary"><p><span class="ex-live-dot" aria-hidden="true"></span>${plural(graph.transactionCount, 'transaction')} connected${e(selectedTitle)}</p><span>Line width represents amount</span></div>
    <div class="ex-graph-labels" aria-hidden="true">${visible.columns.map((column, index) => `<span><b>0${index + 1}</b>${columnNames[column.kind]}</span>`).join('')}</div>
    <div class="ex-graph" style="--graph-height:${height}px"><svg class="ex-graph-lines" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${pathHTML}</svg>
      ${visible.columns.map((column, index) => `<section class="ex-graph-column ex-column-${column.kind}" style="--column-left:${lefts[index] / width * 100}%;--column-width:${nodeWidth / width * 100}%" aria-label="${columnNames[column.kind]}"><h3 class="ex-mobile-column-heading"><span>0${index + 1}</span>${columnNames[column.kind]}</h3>${column.shown.map(node => {
        const status = nodeStatus(node), selected = node.id === selectedNode?.id, related = !relevantIds || node.transactionIds.some(id => relevantIds.has(id));
        return `<button type="button" class="ex-node ${selected ? 'is-selected' : ''} ${selectedNode && !related ? 'is-muted' : ''} ${node.kind === 'account' ? `ex-account-${node.accountType}` : ''}" style="--node-top:${locations.get(node.id).y - 32}px;--node-color:${CATEGORIES[node.key]?.color || '#6a8660'}" data-explorer-kind="${node.kind}" data-explorer-key="${e(node.key)}" aria-pressed="${selected}" aria-label="Explore ${e(node.kind === 'account' ? node.accountTypeLabel + ': ' : '')}${e(node.label)}, ${e(preciseMoney(node.amount))}, ${plural(node.count, 'transaction')}" title="${e(node.label)}"><span class="ex-node-top"><span class="ex-node-label">${e(node.label)}</span><span class="ex-node-amount">${e(compact(node.amount))}</span></span><span class="ex-node-bottom"><span>${node.kind === 'account' ? e(node.accountTypeLabel) : plural(node.count, 'payment')}</span>${node.kind === 'account' ? `<span>${plural(node.count, 'row')}</span>` : `<span class="ex-node-status ${status.className}">${status.label}</span>`}</span></button>`;
      }).join('')}<span class="ex-mobile-hidden">${column.hidden ? `${plural(column.hidden, 'more connection')} available through search` : ''}</span></section>`).join('')}
    </div>
    <div class="ex-coverage"><span><b>${count(visible.paths.length)} of ${count(graph.transactionCount)}</b> transactions have their complete path visible${graph.transactionCount ? ` · ${(visible.paths.length / graph.transactionCount * 100).toFixed(0)}% of rows` : ''}.</span>${visible.hidden ? `<span>${plural(visible.hidden, 'node')} hidden: ${visible.columns.filter(column => column.hidden).map(column => `${column.hidden} ${column.kind === 'category' ? 'categories' : column.kind + 's'}`).join(', ')}. Search to find them.</span>` : '<span>All connections fit in this map.</span>'}</div>
    <p class="ex-footnote">Node totals include every matching transaction, including connections outside this map. Select a node to see the evidence. These are statement relationships, not verified ownership or matched transfers.</p>`;
}

function selectionTitle(selection, rows) {
  if (!selection) return 'Follow a connection.';
  if (selection.kind === 'question') return QUESTION_LABELS[selection.key] || 'Selected transactions';
  if (selection.kind === 'account') {
    const row = rows[0];
    if (row) return accountLabel(row);
    try { return JSON.parse(selection.key)[1]; } catch { return 'Selected account'; }
  }
  return selection.key;
}

function renderEvidence(rows, selection, direction) {
  const selected = Boolean(selection), sorted = [...rows].sort((a, b) => amountOf(b, direction) - amountOf(a, direction) || String(b.date).localeCompare(String(a.date)));
  const shown = sorted.slice(0, 8), reviewCount = rows.filter(t => t.review).length;
  if (!selected) return `<aside class="ex-evidence ex-evidence-idle"><span class="ex-kicker">EVERY CONNECTION HAS A RECEIPT</span><h2>Follow a connection.</h2><p>Select any account, category or merchant to see the transactions behind it.</p><div class="ex-evidence-key"><span><i class="suggested"></i>Suggested from narration</span><span><i class="edited"></i>Edited by you</span><span><i class="review"></i>Needs review</span></div><div class="ex-proof-card"><span class="ex-proof-icon" aria-hidden="true">↗</span><div><b>Back to the source</b><p>Each payment links to its imported statement and source row. Open a payment to inspect or correct its category.</p></div></div></aside>`;
  return `<aside class="ex-evidence" aria-label="Selected connection evidence"><div class="ex-evidence-title"><span class="ex-kicker">${selection.kind === 'question' ? 'EXPLORE A QUESTION' : e(selection.kind.toUpperCase()) + ' CONNECTION'}</span><button type="button" class="ex-clear" data-explorer-clear aria-label="Clear selected connection">×</button></div><h2>${e(selectionTitle(selection, rows))}</h2><div class="ex-evidence-total">${money(totalOf(rows, direction))}</div><p class="ex-evidence-meta">${plural(rows.length, 'transaction')} · ${direction === 'credit' ? 'credit activity' : 'debit activity'}${reviewCount ? ` · ${count(reviewCount)} to review` : ''}</p>
    ${selection.kind === 'question' && selection.key === 'recurring' ? '<p class="ex-question-note">Candidates appear in at least 3 calendar months; at least 65% of their amounts are within 15% of the median. This does not confirm a subscription.</p>' : ''}
    ${selection.kind === 'question' && selection.key === 'purchases' ? '<p class="ex-question-note">Categories marked as purchases, including your edits. Category suggestions still need checking against the statement.</p>' : ''}
    ${!rows.length ? '<div class="ex-evidence-empty">No matching transactions in the current direction and search. Try clearing the selection or changing the filters.</div>' : `<div class="ex-receipts">${shown.map(t => `<button type="button" class="ex-receipt" data-detail="${e(t.id)}" aria-label="Open ${e(merchantOf(t))}, ${e(preciseMoney(amountOf(t, direction)))}, ${e(t.date)}"><span class="ex-receipt-head"><b>${e(merchantOf(t))}</b><strong>${preciseMoney(amountOf(t, direction))}</strong></span><span class="ex-receipt-meta">${e(t.date || 'Date unavailable')} · ${e(typeLabel(typeOf(t)))} · ${e(accountLabel(t))}</span><span class="ex-receipt-category">${e(categoryOf(t))}<span class="ex-status ${t.review ? 'review' : t.classification === 'Edited' ? 'edited' : 'suggested'}">${statusOf(t)}</span></span><span class="ex-receipt-source">${e(t.source || 'Source unavailable')} · ${t.row !== null && t.row !== undefined ? `${t.sourcePage?'page '+e(t.sourcePage)+' · ':''}source row ${e(t.row)}` : 'source row unavailable'}<span aria-hidden="true">↗</span></span></button>`).join('')}</div><p class="ex-footnote">${rows.length > shown.length ? `Largest ${shown.length} of ${count(rows.length)} matching transactions shown. ` : ''}Open a payment for its narration and category controls.</p>`}
  </aside>`;
}

export function renderExplorer(transactions, {selection = null, query = '', direction = 'debit'} = {}) {
  const field = directionOf(direction), searched = searchExplorerRows(transactions, query, field);
  const graphRows = selection?.kind === 'question' ? selectExplorerRows(searched, selection, field) : searched;
  const graph = buildGraph(graphRows, {direction: field}), insights = explorerInsights(searched, field);
  const evidenceRows = selectExplorerRows(searched, selection, field);
  return `<div class="explorer"><section class="ex-intro"><div><span class="ex-kicker">FROM STATEMENT TO STORY</span><h2>Your money, connected.</h2><p>See how accounts, purposes and counterparties relate. Follow any connection back to the payments behind it.</p></div><span class="ex-local-badge"><span></span>Built in your browser · INR</span></section>
    <div class="ex-controls"><label class="ex-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><span class="ex-sr-only">Search connections</span><input id="explorer-search" type="search" value="${e(query)}" placeholder="Search connections…" autocomplete="off"></label><div class="ex-direction" role="group" aria-label="Transaction direction"><button type="button" data-explorer-direction="debit" class="${field === 'debit' ? 'active' : ''}" aria-pressed="${field === 'debit'}">Debits <span>↗</span></button><button type="button" data-explorer-direction="credit" class="${field === 'credit' ? 'active' : ''}" aria-pressed="${field === 'credit'}">Credits <span>↙</span></button></div><button type="button" class="ex-export" data-explorer-export>Export graph <span aria-hidden="true">↓</span></button></div>
    <div class="ex-questions" role="group" aria-label="Explore a question"><span>Start with a question</span><button type="button" data-explorer-kind="question" data-explorer-key="purchases" aria-pressed="${selection?.kind === 'question' && selection.key === 'purchases'}" ${field === 'credit' ? 'disabled title="Purchase questions apply to debits. Switch to Debits to explore."' : ''}>Where do I spend most? <span>↗</span></button><button type="button" data-explorer-kind="question" data-explorer-key="recurring" aria-pressed="${selection?.kind === 'question' && selection.key === 'recurring'}" ${field === 'credit' ? 'disabled title="Recurring-payment questions apply to debits. Switch to Debits to explore."' : ''}>What keeps coming back? <span>↻</span></button><button type="button" data-explorer-kind="question" data-explorer-key="review" aria-pressed="${selection?.kind === 'question' && selection.key === 'review'}">What needs a closer look? <span>${count(insights.reviewCount)}</span></button></div>
    <div class="ex-observations"><div><span>${field === 'debit' ? 'Bank debits' : 'Bank credits'}</span><strong>${money(insights.bankTotal)}</strong><small>${field === 'debit' ? 'Includes transfers and card bills' : 'Includes refunds and transfers'}</small></div><div><span>${field === 'debit' ? 'Card debits' : 'Card credits'}</span><strong>${money(insights.cardTotal)}</strong><small>Card statement activity only</small></div><div class="ex-observation-review"><span>Needs review</span><strong>${money(insights.reviewTotal)}</strong><small>${plural(insights.reviewCount, 'unclear payment')}</small></div></div>
    <div class="ex-workbench"><section class="ex-map-panel" aria-label="Interactive statement relationship map"><div class="ex-map-heading"><div><span class="ex-kicker">CONNECTION MAP</span><h2>${selection?.kind === 'question' ? e(QUESTION_LABELS[selection.key] || 'Selected connections') : 'A path through your payments'}</h2></div>${selection ? '<button type="button" class="ex-reset-selection" data-explorer-clear>Clear selection ↺</button>' : ''}</div>${renderMap(graph, selection)}</section>${renderEvidence(evidenceRows, selection, field)}</div>
    <div class="ex-method"><span aria-hidden="true">i</span><p><b>What this map knows.</b> Accounts come from your import labels; merchant names and categories are suggested from statement narrations and your corrections. Bank debits and card debits are shown separately because a card bill and its purchases can describe the same activity. Amounts assume INR. This view uses the current date and category filters${query ? ', plus your search' : ''}.</p></div></div>`;
}
