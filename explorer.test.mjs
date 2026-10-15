import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import {buildGraph, explorerAccountKey, explorerInsights, recurringExplorerMerchants, renderExplorer, searchExplorerRows, selectExplorerRows} from './dist/explorer.mjs';

const base = {date: '2026-01-10', debit: 100, credit: 0, account: 'bank', accountKey: 'Main', merchant: 'A merchant', category: 'Shopping', classification: 'Suggested', review: false, source: 'statement.csv', sourceId: 'source', row: 2, description: 'CARD purchase', reason: 'Merchant wording'};
const tx = (id, values = {}) => ({...base, id, ...values});
const rows = [tx('bank'), tx('card', {account: 'card', debit: 250}), tx('credit', {debit: 0, credit: 1000, category: 'Salary'}), tx('review', {debit: 90, merchant: 'Unknown', category: 'Transfers · review', review: true}), tx('edited', {debit: 60, classification: 'Edited'})];

const graph = buildGraph(rows);
assert.equal(graph.transactionCount, 4);
assert.equal(graph.totalAmount, 500);
assert.equal(graph.currency, 'INR');
assert.equal(graph.nodes.filter(n => n.kind === 'account').length, 2, 'Bank and card with the same label stay separate.');
assert.notEqual(explorerAccountKey(rows[0]), explorerAccountKey(rows[1]));
assert.deepEqual(selectExplorerRows(rows, {kind: 'account', key: explorerAccountKey(rows[0])}).map(t => t.id), ['bank', 'review', 'edited']);
assert.equal(graph.nodes.find(n => n.kind === 'merchant' && n.key === 'A merchant').amount, 410);
assert.equal(graph.nodes.find(n => n.kind === 'category' && n.key === 'Shopping').statuses.Edited, 1);
assert.equal(graph.nodes.find(n => n.kind === 'category' && n.key === 'Transfers · review').statuses['Needs review'], 1);
for (const link of graph.links) {
  const evidence = graph.evidence.filter(t => link.transactionIds.includes(t.transactionId));
  assert.equal(evidence.length, link.count);
  assert.equal(evidence.reduce((sum, t) => sum + t.amount, 0), link.amount, 'Every relationship amount is supported by source transactions.');
}
assert.equal(buildGraph(rows, {direction: 'credit'}).totalAmount, 1000);
assert.equal(explorerInsights(rows).bankTotal, 250);
assert.equal(explorerInsights(rows).cardTotal, 250);
assert.equal(explorerInsights(rows).purchaseTotal, 410);
assert.deepEqual(selectExplorerRows(rows, {kind: 'question', key: 'review'}).map(t => t.id), ['review']);
assert.equal(selectExplorerRows(rows, {kind: 'question', key: 'purchases'}).length, 3);
assert.equal(searchExplorerRows(rows, 'STATEMENT.CSV').length, 4);
assert.equal(searchExplorerRows(rows, 'credit card').length, 1);
assert.equal(searchExplorerRows(rows, 'not found').length, 0);
assert.equal(buildGraph([tx('negative', {debit: -3}), tx('zero', {debit: 0}), tx('nan', {debit: NaN})]).transactionCount, 0);

const repeated = [tx('jan', {debit: 500, date: '2026-01-01'}), tx('feb', {debit: 510, date: '2026-02-01'}), tx('mar', {debit: 490, date: '2026-03-01'})];
assert.equal(recurringExplorerMerchants(repeated).length, 1);
assert.equal(recurringExplorerMerchants(repeated.slice(0, 2)).length, 0, 'Two months cannot establish a recurring candidate.');
assert.equal(recurringExplorerMerchants(repeated.map(t => ({...t, review: true}))).length, 0);
assert.equal(recurringExplorerMerchants(repeated.map(t => ({...t, category: 'Credit card payments'}))).length, 0);
assert.equal(selectExplorerRows(repeated, {kind: 'question', key: 'recurring'}).length, 3);

const dangerous = tx('safe-id', {merchant: '<img src=x onerror=alert(1)>', accountKey: 'A " bank <script>', source: '<script>source</script>.csv', category: 'Shopping', debit: 4.25});
const {document: escaped} = parseHTML(renderExplorer([dangerous], {selection: {kind: 'merchant', key: dangerous.merchant}}));
assert.equal(escaped.querySelectorAll('img,script').length, 0);
assert.equal(escaped.querySelector('[data-explorer-kind="merchant"]').dataset.explorerKey, dangerous.merchant);
assert.equal(escaped.querySelector('[data-explorer-kind="account"]').dataset.explorerKey, explorerAccountKey(dangerous));
assert.equal(escaped.querySelector('[data-detail]').dataset.detail, 'safe-id');
assert.ok(escaped.querySelector('[data-detail]').textContent.includes('source row 2'));
assert.ok(escaped.querySelector('[data-detail]').textContent.includes('₹4.25'));

const large = Array.from({length: 35}, (_, i) => tx(`large-${i}`, {merchant: `Merchant ${i}`, category: `Category ${i % 12}`, accountKey: `Account ${i % 8}`, debit: i + 1}));
const {document: limited} = parseHTML(renderExplorer(large));
assert.equal(limited.querySelectorAll('.ex-node').length, 5 + 7 + 8);
assert.ok(limited.querySelector('.ex-coverage').textContent.includes('nodes hidden'));
assert.equal(buildGraph(large).evidence.length, 35, 'Export retains every row even when the visual map is capped.');
const {document: forced} = parseHTML(renderExplorer(large, {selection: {kind: 'merchant', key: 'Merchant 0'}}));
assert.equal(forced.querySelector('.ex-node.is-selected').dataset.explorerKey, 'Merchant 0', 'A selected small node stays visible.');
assert.equal(parseHTML(renderExplorer([])).document.querySelectorAll('.ex-empty').length, 1);
assert.ok(!renderExplorer([tx('single')]).includes('NaN'));

const seed = JSON.parse(await readFile(new URL('./dist/seed.json', import.meta.url), 'utf8'));
const actual = buildGraph(seed.transactions);
assert.equal(actual.transactionCount, seed.transactions.filter(t => t.debit > 0).length);
assert.ok(renderExplorer(seed.transactions).includes('Statement account'));
console.log(`Explorer checks passed: traceability, account identity, filters, recurring candidates, escaped HTML, empty/capped views, and ${actual.transactionCount} seed debit transactions.`);
