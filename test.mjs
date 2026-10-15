import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
import {parseAmount,parseDate,detectMapping,parseRows,reconcile,mergeTransactions,effective,sum,stats,CATEGORIES} from './dist/core.mjs';
import {bankBucket,inScope} from './dist/insights.mjs';
const require=createRequire(import.meta.url),XLSX=require('./dist/vendor/xlsx.full.min.js');
const seed=JSON.parse(fs.readFileSync('dist/seed.json','utf8'));
assert.equal(XLSX.version,'0.20.3');
assert.equal(seed.transactions.length,1589);
assert.equal(new Set(seed.transactions.map(t=>t.id)).size,1589);
assert.equal(sum(seed.transactions,'debit'),9783564.64);
assert.equal(sum(seed.transactions,'credit'),13331799.66);
const check=reconcile(seed.transactions);assert.equal(check.errors.length,0);assert.equal(check.opening,3295570.40);assert.equal(check.closing,6843805.42);assert.equal(reconcile([...seed.transactions].reverse()).errors.length,0);
assert.equal(parseAmount('₹1,23,456.78'),123456.78);assert.equal(parseAmount('(200.50)'),-200.50);assert.equal(parseAmount('500 DR'),-500);assert.equal(parseAmount('not an amount'),null);
assert.equal(parseDate('15,10,2026'),'2026-10-15');assert.equal(parseDate('02/03/26','MDY'),'2026-02-03');assert.equal(parseDate('02/03/26','DMY'),'2026-03-02');assert.equal(parseDate('31/02/2026'),null);assert.equal(parseDate('1-Oct-2026'),'2026-10-01');
assert.equal(mergeTransactions(seed.transactions,seed.transactions).added,0);
assert.equal(mergeTransactions(seed.transactions,seed.transactions).duplicate,1589);
const combined=stats([{account:'bank',category:'Credit card payments',debit:1000,credit:0,review:false},{account:'card',category:'Shopping',debit:1000,credit:0,review:false}]);assert.equal(combined.bankDebit,1000);assert.equal(combined.expense,1000);
const fixture=[['Bank statement'],['Date','Description','Debit','Credit','Balance'],['01/10/2026','Amazon order',100,0,900],['01/10/2026','Amazon order',100,0,800],['02/10/2026','Salary',0,1000,1800]];
const detected=detectMapping(fixture),p=parseRows(fixture,{...detected,source:'Fixture.csv'});assert.equal(p.transactions.length,3);assert.equal(new Set(p.transactions.map(t=>t.id)).size,3);assert.equal(reconcile(p.transactions).errors.length,0);assert.equal(stats(p.transactions).expense,200);assert.equal(stats(p.transactions).bankCredit,1000);
const split=[['Date','Description','Amount','Type'],['1/10/2026','Purchase',500,'DR'],['2/10/2026','Refund',100,'CR']];const parsed=parseRows(split,{...detectMapping(split),source:'Signed.csv'});assert.equal(sum(parsed.transactions,'debit'),500);assert.equal(sum(parsed.transactions,'credit'),100);
const reversal=[['Date','Description','Debit','Credit'],['1/10/2026','Reversed purchase',-500,0]];const reversed=parseRows(reversal,{...detectMapping(reversal),source:'Reversal.csv'});assert.equal(reversed.transactions[0].credit,500);assert.equal(reversed.transactions[0].debit,0);
assert.equal(effective(seed.transactions[0],{}, {[seed.transactions[0].merchant+'|debit']:'Shopping'}).category,'Shopping');
assert.equal(seed.transactions.filter(t=>t.category==='Property payments').reduce((s,t)=>s+t.debit,0),6297507);
assert.ok(!seed.transactions.some(t=>/@/.test(t.description)||/\b\d{10,}\b/.test(t.description)),'Sensitive reference in sanitized narration');
if(process.env.STATEMENT_FILE){const wb=XLSX.read(fs.readFileSync(process.env.STATEMENT_FILE),{type:'buffer',cellDates:true,raw:true}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null,raw:true});const parsed=parseRows(rows,{...detectMapping(rows),source:'Original.numbers',accountKey:'Main bank'});assert.equal(parsed.transactions.length,1589);assert.equal(sum(parsed.transactions,'debit'),9783564.64);assert.equal(sum(parsed.transactions,'credit'),13331799.66);assert.equal(mergeTransactions(seed.transactions,parsed.transactions).added,0);assert.equal(reconcile(parsed.transactions).errors.length,0);}
// Bank-flow segments partition the bank outflow, including unclear payments.
const bankDebits=seed.transactions.filter(t=>t.account==='bank'&&t.debit>0);
const bucketTotals=new Map();for(const tx of bankDebits){const key=bankBucket(tx);bucketTotals.set(key,(bucketTotals.get(key)||0)+tx.debit);}
assert.equal(Math.round([...bucketTotals.values()].reduce((a,b)=>a+b,0)*100)/100,stats(seed.transactions).bankDebit);
assert.equal(inScope({account:'card',debit:100,category:'Shopping'},'bankActivity'),false);
assert.equal(inScope({account:'bank',debit:100,category:'Credit card payments'},'purchases'),false);
assert.equal(inScope({account:'card',debit:100,category:'Shopping'},'purchases'),true);
// Exercise the actual DOM controllers without a browser or network.
const {window}=parseHTML(fs.readFileSync('dist/index.html','utf8'));const {document}=window;const storage=new Map();
Object.assign(globalThis,{window,document,location:new URL('https://dashboard.test/#overview'),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async()=>({json:async()=>structuredClone(seed)}),confirm:()=>true,XLSX});
window.scrollTo=()=>{};for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
await import('./dist/app.mjs');
const click=el=>{assert.ok(el,'Missing UI control');el.dispatchEvent(new window.Event('click',{bubbles:true}));};
const change=el=>el.dispatchEvent(new window.Event('change',{bubbles:true}));
const route=name=>{location.hash=name;window.dispatchEvent(new window.Event('hashchange'));assert.ok(document.querySelector('main h1'));assert.ok(!document.querySelector('main').textContent.includes('NaN'));};
assert.ok(document.querySelector('main').textContent.includes('₹97,83,565'));
for(const p of ['transactions','patterns','planner','data','overview'])route(p);
route('transactions');assert.equal(document.querySelectorAll('tbody tr').length,35);
click(document.querySelector('[data-detail]'));assert.ok(document.querySelector('#detail-dialog').hasAttribute('open'));
click(document.querySelector('[data-save-detail]'));assert.ok(storage.size>0);
const q=document.querySelector('#tx-search');q.value='Netflix';q.dispatchEvent(new window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,220));assert.ok(document.querySelector('main').textContent.includes('12 matches'));
click(document.querySelector('[data-action="reset-filters"]'));assert.equal(document.querySelectorAll('tbody tr').length,35);
route('planner');const annual=document.querySelector('#plan-spend');annual.value='800000';change(annual);assert.ok(document.querySelector('.planner-result').textContent.includes('100% of target'));assert.ok(document.querySelector('.planner-result').textContent.includes('− ₹0'));
const lowerAnnual=document.querySelector('#plan-spend');lowerAnnual.value='100000';change(lowerAnnual);assert.ok(document.querySelector('.planner-result').textContent.includes('− ₹11,800'));
route('overview');click(document.querySelector('[data-month]'));assert.equal(document.querySelector('#filter-from').value.slice(0,7),seed.transactions[0].date.slice(0,7));click(document.querySelector('[data-action="reset-filters"]'));
// Chart drilldowns reset stale transaction filters while preserving the chosen period/category.
route('overview');click(document.querySelector('[data-category="Groceries"]'));assert.equal(location.hash,'#transactions');assert.equal(document.querySelector('#filter-category').value,'Groceries');
click(document.querySelector('[data-action="reset-filters"]'));route('overview');click(document.querySelector('[data-scope="bankPurchases"]'));assert.equal(document.querySelector('#tx-scope').value,'bankPurchases');
click(document.querySelector('[data-action="reset-filters"]'));route('overview');click(document.querySelector('[data-period="3"]'));assert.equal(document.querySelector('#filter-from').value,'2026-08-01');
click(document.querySelector('[data-action="reset-filters"]'));route('overview');click(document.querySelector('[data-month]'));assert.equal(document.querySelector('#tx-scope').value,'purchases');
click(document.querySelector('[data-action="reset-filters"]'));
// Import test: a new bank CSV, then exact overlapping Numbers file.
const input=document.querySelector('#file-input');
const chooseFile=async(file)=>{Object.defineProperty(input,'files',{value:[file],configurable:true});change(input);await new Promise(r=>setTimeout(r,40));};
await chooseFile(new File(['Date,Description,Debit,Credit\n14/10/2026,Test shopping,100,0\n15/10/2026,Test transfer,0,50'],'Additional.csv'));
assert.equal(document.querySelector('.import-summary strong').textContent,'2');click(document.querySelector('[data-action="confirm-import"]'));assert.equal(JSON.parse(storage.values().next().value).transactions.length,1591);
if(process.env.STATEMENT_FILE){await chooseFile(new File([fs.readFileSync(process.env.STATEMENT_FILE)],'Original.numbers'));assert.ok(document.querySelector('#import-body').textContent.includes('1589 exact overlaps'));click(document.querySelector('[data-action="confirm-import"]'));assert.equal(JSON.parse(storage.values().next().value).transactions.length,1591);}
route('data');assert.ok(document.querySelector('main').textContent.includes('2 sources'));
const backup=JSON.parse(storage.values().next().value);await chooseFile(new File([JSON.stringify(backup)],'backup.json'));assert.ok(document.querySelector('[data-action="confirm-backup"]'));click(document.querySelector('[data-action="confirm-backup"]'));assert.equal(JSON.parse(storage.values().next().value).transactions.length,1591);
assert.ok(Object.keys(CATEGORIES).every(c=>typeof c==='string'));
console.log(JSON.stringify({status:'passed',parser:XLSX.version,sourceTransactions:1589,checks:'Source totals and every balance; duplicate retention and overlap skips; bank/card separation; date/amount formats; all five views; category persistence; search/date filters; planner thresholds; CSV import; backup restore; bank-flow partition; chart drilldowns; date presets.'}));
