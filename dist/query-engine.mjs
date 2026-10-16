import {CATEGORIES, preciseMoney} from './core.mjs';
import {recurringExplorerMerchants} from './explorer.mjs';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const groupKey = t => JSON.stringify([t.merchant || 'Unknown', t.category || 'Uncategorized']);
export const total = (rows, field = 'debit') => rows.reduce((n, t) => n + Math.round((t[field] || 0) * 100), 0) / 100;
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const previousMonth = m => {const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth()-1); return d.toISOString().slice(0,7);};
export const monthName = m => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-IN', {month:'short', year:'numeric',timeZone:'UTC'});

// Plans contain only data filters and fixed computations. No generated code is executed.
export function planQuestion(question, transactions, previous = null) {
  const q = norm(question), latest = transactions.map(t => t.date).sort().at(-1)?.slice(0,7);
  const followup = !!previous && /^(only|just|and |what about|how about|compare|show all history|show (those|these|their)|of those|same|now |explain this)/.test(q);
  const plan = followup ? {...previous, question, followup:true} : {question, direction:'debit', expense:false, account:'all', accountKey:null, categories:[], merchants:[], semanticKeys:null, period:null, compare:false, increaseOnly:false, recurring:false, review:false, group:'merchant', min:null, max:null, followup:false};
  if (!q || !latest) return {...plan, error: !q ? 'Type a question to start.' : 'Import a statement to ask about its connections.'};
  if (/\b(week|weeks|yesterday|today|tomorrow|daily|year|years|net|average|median|percentage|percent|except|excluding|exclude|without)\b/.test(q)) return {...plan,error:'That calculation or filter is not supported in this version. Use the date/category filters above, then ask for totals, largest groups, recurring candidates or a calendar-month comparison.'};
  if ((question.match(/\b20\d{2}-(?:0[1-9]|1[0-2])\b/g)||[]).length>1 || months.filter(m=>new RegExp('\\b'+m+'\\b').test(q)).length>1) return {...plan,error:'For a comparison, name the later month and ask to compare it with the previous month. For other ranges, set the date filters above.'};
  if (/\b(?:last|past) \d+ months?\b/.test(q)) return {...plan,error:'Use the “Last 3 months” or “Last 6 months” filter above, then ask your question. Month comparisons support one calendar month and its preceding month.'};
  if (/\b(predict|forecast|should i|recommend|fraud|tax advice|who owns|owned by|next month|next year)\b/.test(q)) return {...plan, error:'I can describe recorded payments and their connections, but this view cannot predict spending, verify fraud or ownership, or give financial advice. Try “Which merchants increased?” or “Show payments needing review”.'};
  if (/\b(credit card|card purchases|card payments|my card)\b/.test(q) && !/card bill/.test(q)) plan.account = 'card';
  if (/\b(bank|bank account)\b/.test(q)) plan.account = 'bank';
  if (/\b(all accounts|both accounts)\b/.test(q)) {plan.account = 'all'; plan.accountKey = null;}
  for (const name of [...new Set(transactions.map(t=>t.accountKey))].filter(Boolean).sort((a,b)=>b.length-a.length)) {
    if (norm(name).length > 3 && q.includes(norm(name))) {plan.accountKey = name; break;}
  }
  if (/\b(income|money in|money came in|credits|refunds|received|salary)\b/.test(q)) {plan.direction='credit'; plan.expense=false;}
  if (/\b(debits|money out|outflow|paid|spend|spending|spent|purchases|expenses|costs)\b/.test(q)) plan.direction='debit';
  if (/\b(spend|spending|spent|purchases|expenses|costs)\b/.test(q)) plan.expense=true;
  if (/\b(all debits|all payments|money out|outflow|transfers|card bill)\b/.test(q)) plan.expense=false;
  if (/\b(recurring|repeated|keeps coming back)\b/.test(q)) {plan.recurring=true; plan.expense=true;}
  if (/\b(review|unclear|unclassified|closer look)\b/.test(q)) {plan.review=true; plan.expense=false;}
  if (/\b(compare|increase|increased|higher|changed|change|why|rose|risen|went up|decreased|lower)\b/.test(q)) plan.compare=true;
  if (/\b(increase|increased|higher|rose|risen|went up)\b/.test(q)) plan.increaseOnly=true;
  if (/\b(category|categories|where do|where did|what do i spend on)\b/.test(q)) plan.group='category';
  if (/\b(merchant|merchants|who|places)\b/.test(q)) plan.group='merchant';
  if (/\b(this month|latest month)\b/.test(q)) plan.period=latest;
  if (/\blast month\b/.test(q) && !/\bcompare.*last month\b/.test(q)) plan.period=previousMonth(latest);
  const ym=question.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (ym) plan.period=ym[0];
  const named=months.findIndex(m=>new RegExp('\\b'+m+'\\b').test(q));
  if(/\b20\d{2}\b/.test(q)&&!ym&&named<0) return {...plan,error:'Set a year or date range using the filters above, or name a month such as September 2026.'};
  if(named>=0) plan.period=`${q.match(/\b20\d{2}\b/)?.[0] || latest.slice(0,4)}-${String(named+1).padStart(2,'0')}`;
  if (/\b(all history|all months|whole period)\b/.test(q)) {plan.period=null; plan.compare=false;}
  const min=question.match(/\b(?:over|above|more than)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/i), max=question.match(/\b(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/i);
  if(min) plan.min=Number(min[1].replaceAll(',','')); if(max) plan.max=Number(max[1].replaceAll(',',''));
  // Entity names are resolved against this analysis only.
  const exactCategories=Object.keys(CATEGORIES).filter(c=>norm(c).split(' ').filter(w=>w.length>3&&!['review','payments','credits','confirmed','merchant','transfers','card','credit'].includes(w)).some(w=>new RegExp('\\b'+w+'\\b').test(q)));
  const exactMerchants=[...new Set(transactions.map(t=>t.merchant))].filter(Boolean).filter(m=>norm(m).length>2 && new RegExp('(?:^| )'+norm(m)+'(?: |$)').test(q));
  if(exactCategories.length) {plan.categories=exactCategories; plan.semanticKeys=null;}
  if(exactMerchants.length) {plan.merchants=exactMerchants; plan.semanticKeys=null;}
  if(/\bor\b/.test(q)&&exactCategories.length&&exactMerchants.length) return {...plan,error:'Ask about the merchant and category separately, or use the filters above. This version combines named merchant and category filters as an intersection.'};
  const structural = plan.review || plan.recurring || plan.compare || plan.account!=='all' || plan.min!==null || plan.max!==null || /\b(recurring|repeated|keeps coming back|review|unclear|category|categories|merchant|merchants|largest|biggest|most|spend|spending|spent|expenses|purchases|compare|increase|increased|changed|change|total|how much|income|credits|debits|money in|money out|all payments|all debits|all credits)\b/.test(q);
  let leftover=q;
  for(const name of [...exactCategories,...exactMerchants,plan.accountKey||''].filter(Boolean)) for(const word of norm(name).split(' ')) if(word.length>2) leftover=leftover.replace(new RegExp('\\b'+word+'\\b','g'),' ');
  leftover=leftover.replace(/\b(20\d{2}|\d+)\b/g,' ').replace(/\b(which|what|where|when|why|how|much|many|do|did|does|is|are|was|were|i|my|me|the|a|an|to|for|of|on|in|at|with|from|through|and|or|about|show|find|tell|needs|need|only|just|those|these|their|it|that|this|same|now|all|both|any|please|spend|spending|spent|purchases|payments|payment|expenses|costs|paid|transactions|transaction|money|out|in|credits|debits|income|received|came|bank|account|accounts|credit|card|latest|last|month|months|history|whole|period|compare|compared|versus|vs|increased|increase|higher|decreased|lower|changed|change|rose|risen|went|up|largest|biggest|most|top|total|recurring|repeated|keeps|coming|back|review|unclear|unclassified|closer|look|category|categories|merchant|merchants|places|over|above|more|than|under|below|less|rs|inr|january|february|march|april|may|june|july|august|september|october|november|december)\b/g,' ').replace(/\s+/g,' ').trim();
  plan.semanticText=leftover && !exactMerchants.length ? leftover : '';
  if (!structural && !exactCategories.length && !exactMerchants.length && !followup && !plan.semanticText) plan.semanticText=q;
  if(plan.compare) {plan.period ||= latest; plan.previousPeriod=previousMonth(plan.period);}
  if(plan.direction==='credit') {plan.expense=false; plan.recurring=false;}
  return plan;
}

export function semanticDocuments(transactions) {
  const groups=new Map();
  for(const t of transactions){const key=groupKey(t);if(!groups.has(key))groups.set(key,{key,merchant:t.merchant,category:t.category,descriptions:new Set(),ids:[]});const g=groups.get(key);if(g.descriptions.size<3)g.descriptions.add(t.description||'');g.ids.push(t.id);}
  return [...groups.values()].map(g=>({key:g.key,label:g.merchant,category:g.category,ids:g.ids,text:`title: ${g.merchant} | text: ${g.category}. ${[...g.descriptions].join('. ').slice(0,600)}`}));
}

export function executeQuestion(transactions, plan) {
  if(plan.error)return {plan,rows:[],error:plan.error};
  let list=transactions.filter(t=>t[plan.direction]>0 && (plan.account==='all'||t.account===plan.account) && (!plan.accountKey||t.accountKey===plan.accountKey) && (!plan.expense||CATEGORIES[t.category]?.expense) && (!plan.review||t.review) && (!plan.categories.length||plan.categories.includes(t.category)) && (!plan.merchants.length||plan.merchants.includes(t.merchant)) && (!plan.semanticKeys||plan.semanticKeys.includes(groupKey(t))) && (plan.min===null||t[plan.direction]>plan.min) && (plan.max===null||t[plan.direction]<plan.max));
  if(plan.recurring){const keys=new Set(recurringExplorerMerchants(list,plan.direction).map(g=>g.key));list=list.filter(t=>keys.has(t.merchant)&&!t.review);}
  if(plan.period)list=list.filter(t=>t.date.startsWith(plan.period)||(plan.compare&&t.date.startsWith(plan.previousPeriod)));
  const current=plan.compare?list.filter(t=>t.date.startsWith(plan.period)):list, prior=plan.compare?list.filter(t=>t.date.startsWith(plan.previousPeriod)):[];
  const groups=new Map();
  for(const t of list){const key=t[plan.group];if(!groups.has(key))groups.set(key,{key,current:[],previous:[],ids:[]});const g=groups.get(key);g.ids.push(t.id);(plan.compare&&t.date.startsWith(plan.previousPeriod)?g.previous:g.current).push(t);}
  const comparisons=[...groups.values()].map(g=>({...g,total:total(g.current,plan.direction),before:total(g.previous,plan.direction),delta:total(g.current,plan.direction)-total(g.previous,plan.direction)})).filter(g=>!plan.increaseOnly||g.delta>0).sort((a,b)=>plan.compare?b.delta-a.delta:b.total-a.total);
  // Show all rows belonging to matching groups, never a nearest-neighbor sample total.
  if(plan.increaseOnly){const ids=new Set(comparisons.flatMap(g=>g.ids));list=list.filter(t=>ids.has(t.id));}
  const visibleCurrent=list.filter(t=>!plan.compare||t.date.startsWith(plan.period)),visiblePrior=plan.compare?list.filter(t=>t.date.startsWith(plan.previousPeriod)):[];
  const metrics=['bank','card'].map(account=>({account,current:total(visibleCurrent.filter(t=>t.account===account),plan.direction),previous:total(visiblePrior.filter(t=>t.account===account),plan.direction)}));
  const scope=[plan.direction==='credit'?'credits':plan.expense?'identified purchases':'debits',plan.account!=='all'?plan.account+' accounts':null,plan.accountKey,...plan.categories,...plan.merchants,plan.review?'needs review':null,plan.recurring?'recurring candidates':null,plan.period?(plan.compare?monthName(plan.previousPeriod)+' → ':'')+monthName(plan.period):'selected date range',plan.min!==null?'over '+preciseMoney(plan.min):null,plan.max!==null?'under '+preciseMoney(plan.max):null].filter(Boolean);
  let text = !list.length ? 'No matching transactions in this view. Try a wider date range or a different question.' : plan.compare ? `Compared ${monthName(plan.period)} with ${monthName(plan.previousPeriod)}${plan.increaseOnly?' for groups whose recorded amount increased':''}. ${comparisons.length} ${plan.group} groups match.` : `Found ${list.length.toLocaleString('en-IN')} matching transactions across ${comparisons.length} ${plan.group} groups.`;
  if(plan.semanticKeys)text='These are suggested semantic matches. '+text+' Check the matching groups before treating this as a complete answer.';
  const notes=[];
  if(plan.compare) notes.push('Calendar-month comparison uses the latest statement month unless you name one. Coverage may be partial; no rows is not proof of no activity.');
  if(plan.recurring) notes.push('Recurring candidates appear in at least 3 months, with at least 65% of amounts within 15% of their median. A candidate is not a confirmed subscription.');
  if(plan.expense) notes.push('Uses current purchase categories; excludes transfers, card bill payments and investments.');
  if(plan.direction==='debit'&&!plan.expense&&plan.account==='all')notes.push('Bank and card totals are separate: card bills and card purchases may describe the same spending.');
  if(/\bwhy\b/i.test(plan.question)) notes.push('This shows which records explain the numerical change; it does not establish the cause.');
  if(plan.compare&&(!current.length||!prior.length)) notes.push('One comparison period has no matching rows. Import its statement or broaden the filters before drawing conclusions.');
  return {plan,rows:list,metrics,groups:comparisons,scope,text,notes,semantic:!!plan.semanticKeys};
}
