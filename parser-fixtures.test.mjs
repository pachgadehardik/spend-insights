import assert from 'node:assert/strict';
import {parseAmount,parseDate,detectMapping,parseRows,identify,reconcile,hash,sum} from './dist/core.mjs';

const read=(rows,options={})=>parseRows(rows,{...detectMapping(rows),...options});
// Synthetic INR export fixtures exercise formats, not claimed bank certifications.
const bankHeaders=[
  ['Tran Date','Particulars','Withdrawal (Dr)','Deposit (Cr)','Closing Balance'],
  ['Txn Date','Transaction Remarks','Debit (INR)','Credit (INR)','Balance (INR)'],
  ['Transaction Date','Narration','Withdrawal Amt.','Deposit Amt.','Closing Balance'],
  ['Posting Date','Details','Debit Amount (Rs.)','Credit Amount (Rs.)','Running Balance'],
  ['Date','Payee Name','Money Out','Money In','Balance'],
  ['Date','Description','Withdrawals','Deposits','Ledger Balance']
];
for(const headers of bankHeaders){
  const rows=[['Account statement'],headers,['1-Oct-2026','Amazon order','1,200.50','','8,799.50'],['2-Oct-2026','Salary','','50,000.00','58,799.50']];
  const p=read(rows);
  assert.deepEqual(p.schemaErrors,[],headers.join(' / '));
  assert.equal(p.transactions.length,2,headers.join(' / '));
  assert.equal(sum(p.transactions,'debit'),1200.50);
  assert.equal(sum(p.transactions,'credit'),50000);
  assert.equal(reconcile(p.transactions).errors.length,0);
}
// The earliest date-like column need not be the transaction date.
const dates=[['Value Date','Tran Date','Narration','Debit','Credit'],['02/10/2026','01/10/2026','Purchase','100','']];
assert.equal(detectMapping(dates).map.date,1);
assert.equal(read(dates).transactions[0].date,'2026-10-01');
assert.equal(detectMapping([['Transaction Date (DD/MM/YYYY)','Description','Debit','Credit']]).map.date,0);
assert.equal(read([['Date','Description','Debit','Credit'],['01/10/2026','Total',100,0]]).transactions.length,1);
assert.equal(parseDate('2026-10-01T22:45:30.000+05:30'),'2026-10-01');
assert.equal(parseDate('15/10/2026 10:30:00'),'2026-10-15');
assert.equal(parseDate('15/Oct/2026'),'2026-10-15');
assert.equal(parseDate('October 15, 2026'),'2026-10-15');
assert.equal(parseDate('15 Sept. 26'),'2026-09-15');
assert.equal(parseDate('1-Janparty-2026'),null);
assert.equal(parseDate('2026-10-01 garbage'),null);
assert.equal(parseDate('29/02/2025'),null);
assert.equal(parseDate('29/02/2024'),'2024-02-29');
assert.equal(parseDate(46310.9),parseDate(46310));
assert.equal(parseDate('02/03/26','MDY'),'2026-02-03');
assert.equal(parseDate('02/03/26','DMY'),'2026-03-02');

for(const [value,expected] of [['₹1,23,456.78',123456.78],['INR 123,456.78',123456.78],['Rs. 500',500],['500DR',-500],['DR 500',-500],['500 CR',500],['(200.50)',-200.50],['100-',-100],['−100',-100],['.50',.50],['1,2,3',null],['₹1.234,56',null],['USD 500',null],['EUR 100',null],['1e3',null],['Infinity',null],['amount',null]])assert.equal(parseAmount(value),expected,String(value));

// Split columns take precedence over an incidental Amount column.
const split=read([['Date','Description','Amount','Debit','Credit','Balance'],['01/10/2026','Purchase',999,100,'',900]]);
assert.equal(split.transactions[0].debit,100);
const compactMarkers=read([['Date','Description','Debit','Credit','Balance'],['01/10/2026','Purchase','100DR','','900CR'],['02/10/2026','Refund','','50CR','950CR']]);
assert.equal(sum(compactMarkers.transactions,'debit'),100);
assert.equal(sum(compactMarkers.transactions,'credit'),50);
assert.equal(reconcile(compactMarkers.transactions).errors.length,0);
const negativeReversal=read([['Date','Description','Debit','Credit'],['01/10/2026','Reversal',-500,'']]);
assert.equal(negativeReversal.transactions[0].credit,500);

for(const flagName of ['Dr/Cr','Debit/Credit','Transaction Type','Txn Type']){
  const p=read([['Txn Date','Narration','Amount (INR)',flagName],['01/10/2026','Purchase',100,'D'],['02/10/2026','Refund',25,'C']]);
  assert.equal(sum(p.transactions,'debit'),100);
  assert.equal(sum(p.transactions,'credit'),25);
}
const signed=read([['Date','Description','Signed Amount'],['01/10/2026','Purchase',-100],['02/10/2026','Credit',500]],{sign:'credit-positive'});
assert.equal(sum(signed.transactions,'debit'),100);
assert.equal(sum(signed.transactions,'credit'),500);
const attachedFlags=read([['Date','Description','Amount'],['01/10/2026','Purchase','100DR'],['02/10/2026','Credit','500CR']]);
assert.equal(sum(attachedFlags.transactions,'debit'),100);
assert.equal(sum(attachedFlags.transactions,'credit'),500);

// Dated bad values and impossible dates produce source-row diagnostics, never zero-fill.
const broken=[['Date','Description','Debit','Credit','Balance'],
 ['01/10/2026','Valid purchase',100,0,900],
 ['31/02/2026','Impossible date',50,0,850],
 ['02/10/2026','Malformed debit','broken',20,870],
 ['03/10/2026','Two directions',10,10,870],
 ['04/10/2026','',10,0,860],
 ['05/10/2026','Missing amount','','',860],
 ['06/10/2026','Balance invalid',10,0,'corrupt'],
 ['Date','Description','Debit','Credit','Balance'],
 ['','Total',170,30,860],
 ['07/10/2026','Zero amount',0,0,860],
 []];
const malformed=read(broken);
assert.equal(malformed.transactions.length,2);
assert.equal(malformed.counts.invalid,5);
assert.equal(malformed.counts.warnings,1);
assert.equal(malformed.counts.nonTransactions,3);
assert.equal(malformed.counts.zero,1);
assert.deepEqual(malformed.issues.map(i=>i.row),[3,4,5,6,7,8]);
assert.equal(malformed.issues[0].code,'invalid-date');
assert.equal(malformed.issues.at(-1).severity,'warning');
assert.equal(malformed.transactions[1].balance,null);
assert.ok(malformed.warnings.some(w=>w.includes('ambiguous')));
assert.ok(malformed.warnings.some(w=>w.includes('balance')));
const invalidFlag=read([['Date','Description','Amount','Type'],['01/10/2026','Purchase',100,'NEFT']]);
assert.equal(invalidFlag.counts.invalid,1);
assert.equal(invalidFlag.issues[0].code,'invalid-direction');
const conflictingFlag=read([['Date','Description','Amount','Type'],['01/10/2026','Purchase','100DR','CR']]);
assert.equal(conflictingFlag.issues[0].code,'conflicting-direction');
const conflictingColumn=read([['Date','Description','Debit','Credit'],['01/10/2026','Purchase','100CR','']]);
assert.equal(conflictingColumn.issues[0].code,'conflicting-direction');
const missingDate=read([['Date','Description','Debit','Credit'],['','Purchase',100,'']]);
assert.equal(missingDate.issues[0].code,'invalid-date');

const validTable=[['Date','Description','Debit','Credit'],['01/10/2026','Purchase',100,'']];
for(const options of [
 {map:{date:0,description:0,debit:2,credit:3}},
 {map:{date:0,description:1}},
 {map:{date:10,description:1,debit:2}},
 {header:20},
 {dateOrder:'auto'},
 {sign:'guess'}
]){const p=read(validTable,options);assert.equal(p.transactions.length,0);assert.ok(p.schemaErrors.length);}

// Existing fingerprint format and occurrence numbering stay intact.
const compatible=read([['Date','Description','Debit','Credit','Balance'],['01/10/2026','Amazon order',100,0,900],['01/10/2026','Amazon order',100,0,900]],{source:'Other.csv'});
const originalId=hash('Main bank|bank|2026-10-01|amazon order|100.00|0.00|900');
assert.deepEqual(compatible.transactions.map(t=>t.id),[originalId+'-1',originalId+'-2']);
assert.notEqual(identify('ACH/EXAMPLE COMPANY/UNKNOWN',0,1000).category,'Interest & dividends');
assert.notEqual(identify('ACH/FIN INDIAN CLEARING',1000,0).category,'Investments & saving');
assert.equal(identify('ACH/MUTUAL FUND PURCHASE',1000,0).category,'Investments & saving');
assert.equal(identify('Dividend received',0,1000).category,'Interest & dividends');
assert.notEqual(identify('UPI/HARDIK PACHGADE/PAYMENT',100,0).merchant,'Possible own-account transfer');
console.log(JSON.stringify({status:'passed',checks:'Synthetic INR header variants; explicit date/sign choices; ISO and named dates; amount grouping; debit/credit markers; invalid-row diagnostics; schema validation; source-row numbering; fingerprint compatibility; conservative classification.'}));
