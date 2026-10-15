export const CATEGORIES = {
  'Dining & food': {color:'#cf7954',expense:true,card:true},
  'Groceries': {color:'#7e9d77',expense:true,card:true},
  'Shopping': {color:'#b7a4cc',expense:true,card:true},
  'Subscriptions': {color:'#6c89a6',expense:true,card:true},
  'Health': {color:'#d0ae66',expense:true,card:true},
  'Transport & travel': {color:'#a3b2c2',expense:true,card:true},
  'Utilities': {color:'#69a9a1',expense:true,card:true},
  'Insurance': {color:'#a29472',expense:true,card:true},
  'Household & maintenance': {color:'#8b9b82',expense:true,card:true},
  'Rent': {color:'#c1a291',expense:true,card:false},
  'Taxes & fees': {color:'#b29e97',expense:true,card:false},
  'Property payments': {color:'#43594c',expense:false,card:false},
  'Investments & saving': {color:'#739491',expense:false,card:false},
  'Credit card payments': {color:'#c9a575',expense:false,card:false},
  'Cash withdrawals': {color:'#b6b3a5',expense:false,card:false},
  'Transfers · review': {color:'#cabda9',expense:false,card:false},
  'Transfers (confirmed)': {color:'#babba6',expense:false,card:false},
  'Merchant · review': {color:'#c3a084',expense:false,card:false},
  'Uncategorized': {color:'#c6c6c0',expense:false,card:false},
  'Salary': {color:'#5b8068',expense:false,card:false},
  'Interest & dividends': {color:'#90aaa2',expense:false,card:false},
  'Merchant credits & refunds': {color:'#b5baa6',expense:false,card:false},
  'Other credits & transfers': {color:'#abb2b8',expense:false,card:false}
};
export const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
export const preciseMoney = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
export const compact = n => Math.abs(n)>=1e7 ? '₹'+(n/1e7).toFixed(2)+'Cr' : Math.abs(n)>=1e5 ? '₹'+(n/1e5).toFixed(2)+'L' : Math.abs(n)>=1000 ? '₹'+(n/1000).toFixed(1)+'k' : money(n);
export const sum = (a,k) => Math.round(a.reduce((s,t)=>s+(typeof k==='function'?k(t):t[k]||0),0)*100)/100;
export const escapeHTML = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const missingAmount=v=>v===null||v===undefined||/^(?:\s*|[-–—]+|na|n\/a|nil)$/i.test(String(v).trim());
function amountMarker(v){const s=String(v??'').trim();return (s.match(/(?:^|\s)(CR|DR)\s+/i)?.[1]||s.match(/(CR|DR)\.?\s*$/i)?.[1]||'').toUpperCase();}
function withoutAmountMarker(v){return typeof v==='string'?v.trim().replace(/^(?:CR|DR)\s+/i,'').replace(/\s*(?:CR|DR)\.?\s*$/i,''):v;}
export function parseAmount(v) {
  if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER?v:null;
  if(missingAmount(v))return null;
  const marker=amountMarker(v);let s=String(withoutAmountMarker(v)).trim().replace(/\u2212/g,'-');
  const parentheses=/^\(.*\)$/.test(s),trailingMinus=/-$/.test(s);
  if(parentheses)s=s.slice(1,-1).trim();
  if(trailingMinus)s=s.slice(0,-1).trim();
  s=s.replace(/₹|\bINR\b|\bRs\.?/gi,'').replace(/\s/g,'');
  if(!/^[+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)$/.test(s))return null;
  const integer=s.replace(/^[+-]/,'').split('.')[0];
  if(integer.includes(',')&&!/^\d{1,3}(?:,\d{3})+$/.test(integer)&&!/^\d{1,2}(?:,\d{2})*,\d{3}$/.test(integer))return null;
  const number=Number(s.replace(/,/g,''));
  if(!Number.isFinite(number)||Math.abs(number)>Number.MAX_SAFE_INTEGER)return null;
  return parentheses||trailingMinus||marker==='DR'?-Math.abs(number):number;
}
const pad=n=>String(n).padStart(2,'0');
function validDate(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null;}
const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const namedMonth=s=>{const name=s.toLowerCase().replace(/\.$/,'');if(!/^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/.test(name))return 0;return monthNames.indexOf(name.slice(0,3))+1;};
export function parseDate(v,order='DMY'){
  if(v instanceof Date&&!isNaN(v))return validDate(v.getUTCFullYear(),v.getUTCMonth()+1,v.getUTCDate());
  if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);return d.toISOString().slice(0,10);}
  if(typeof v!=='string')return null;
  // Keep the statement's calendar date when an export appends a time or timezone.
  const s=v.trim().replace(/(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*[AP]M)?(?:Z|[+-]\d{2}:?\d{2})?)$/i,'').trim();let m=s.match(/^(\d{4})[-/.,](\d{1,2})[-/.,](\d{1,2})$/);
  if(m)return validDate(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[-/.,](\d{1,2})[-/.,](\d{2}|\d{4})$/);
  if(m){const yr=+m[3]<100?2000+(+m[3]):+m[3];return order==='MDY'?validDate(yr,+m[1],+m[2]):validDate(yr,+m[2],+m[1]);}
  m=s.match(/^(\d{1,2})[\s/.-]+([A-Za-z]{3,9}\.?)\s*[-/.,\s]+(\d{2}|\d{4})$/);
  if(m)return validDate(+m[3]<100?2000+(+m[3]):+m[3],namedMonth(m[2]),+m[1]);
  m=s.match(/^([A-Za-z]{3,9}\.?)\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/);
  if(m)return validDate(+m[3]<100?2000+(+m[3]):+m[3],namedMonth(m[1]),+m[2]);
  return null;
}
export function sanitizeDescription(v){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  if(/^UPI\//i.test(s)){const p=s.split('/');s=['UPI',p[1],p[3]].filter(Boolean).join(' · ');}
  return s.replace(/\b[A-Z]{0,8}[0-9]{7,}[A-Z0-9]*\b/gi,'[reference]').replace(/\b[A-F0-9]{20,}\b/gi,'[reference]').replace(/[\w.+-]+@[\w.-]+/g,'[UPI address]').replace(/ETMONEY\w+/gi,'ETMONEY mandate').replace(/\b\d{6,}\b/g,'[reference]').slice(0,260);
}
export function identify(raw,debit,credit){
 const s=String(raw||''),u=s.toUpperCase(),p=s.split('/');
 let merchant=/^UPI\//i.test(s)?p[1]:sanitizeDescription(s).slice(0,65);
 const choose=(category,label,reason,review=false)=>({category,merchant:label||merchant,reason,review,classification:'Suggested'});
 if(credit>0){
   if(/SALARY|PAYROLL/.test(u))return choose('Salary',/MSCI/.test(u)?'MSCI salary':'Salary credit','Salary/payroll appears in the narration.');
   if(/INT\.PD|INTEREST/.test(u))return choose('Interest & dividends','Bank interest','Interest payment in the narration.');
   if(/DIVIDEND|\bDIV\b/.test(u))return choose('Interest & dividends',p[1]||'Dividend credit','Dividend wording appears in the narration.');
   if(/REFUND|REVERSAL|SWIGGY|ZOMATO|BLINKIT|AMAZON|CLEARTRIP|APPLE MEDI|FIRKI|HOSPITAL/.test(u))return choose('Merchant credits & refunds',merchant,'Merchant credit; may be a refund or reversal.');
   return choose('Other credits & transfers',/^RTGS|^NEFT|^MMT/.test(u)?'Bank transfer received':merchant,'Incoming transfer is not assumed to be earnings.');
 }
 if(/LNTLTD|RERA|EARNEST\s*MONEY|LNT ELIXIR|LNT ELXIR/.test(u))return choose('Property payments','L&T · property payment','RERA/property/token wording in narration; inferred capital payment.');
 if(/CC BILLPAY|CREDIT CA|AUTO DEBIT CC|ONECARD|CRED CLUB|CRED\.CLUB|CREDIT CARD/.test(u))return choose('Credit card payments',/ONECARD/.test(u)?'OneCard settlement':'Credit card settlement','Card bill payment. Purchases are not itemized in the bank statement.');
 if(/ETMONEY|MUTUAL FUND|ZERODHA|GROWW|KUVERA/.test(u))return choose('Investments & saving',/ETMONEY/.test(u)?'ET Money':'Investment transfer','Investment platform or mutual-fund wording; confirm purpose if different.');
 if(/CASH WDL|ATM WDL|ATM CASH|CASH WITHDRAW/.test(u))return choose('Cash withdrawals','Cash withdrawal','Withdrawal is an outflow; its eventual use is not visible.');
 if(/SBI LIFE|POLICYBAZA|INSURANCE|LIC OF INDIA|HDFC LIFE/.test(u))return choose('Insurance',/SBI LIFE/.test(u)?'SBI Life':'Insurance payment','Insurer or insurance platform in narration.');
 if(/CBDT|INCOME TAX|TAX PAYMENT|BANK CHARGE|GST CHARGE|ANNUAL FEE/.test(u))return choose('Taxes & fees',/CBDT/.test(u)?'Income tax':'Tax / fee','Tax or fee appears in narration.');
 if(/MAINTENANCE|SOCIETY DUES|MYGATE|NOBROKERHOOD/.test(u))return choose('Household & maintenance',merchant,'Housing/maintenance wording in narration.');
 if(/\bRENT\b/.test(u))return choose('Rent',merchant,'Rent explicitly appears in narration.');
 if(/SWIGGY INS|INSTAMART/.test(u))return choose('Groceries','Swiggy Instamart','Instamart merchant match.');
 if(/BIGBASKET|BBNOW|INNOVATIVE.?RETA/.test(u))return choose('Groceries','BigBasket','BigBasket / BBNow / Innovative Retail merchant match.');
 if(/BLINKIT/.test(u))return choose('Groceries','Blinkit','Blinkit merchant match.');
 if(/ZEPTO/.test(u))return choose('Groceries','Zepto','Zepto merchant match.');
 if(/FRESHTOHOM/.test(u))return choose('Groceries','FreshToHome','FreshToHome merchant match.');
 if(/DMART|RELIANCE FRESH|SPENCER.*RETAIL/.test(u))return choose('Groceries',merchant,'Grocery merchant match.');
 if(/SWIGGY/.test(u))return choose('Dining & food','Swiggy','Swiggy merchant match; check if this was a different Swiggy service.');
 if(/ZOMATO/.test(u))return choose('Dining & food','Zomato','Zomato merchant match.');
 if(/HUNGERBOX/.test(u))return choose('Dining & food','HungerBox','HungerBox merchant match.');
 if(/MC DONALD|MCDONALD/.test(u))return choose('Dining & food',"McDonald's",'Restaurant merchant match.');
 if(/BLUE TOKAI/.test(u))return choose('Dining & food','Blue Tokai','Cafe merchant match.');
 if(/EATCLUB|DOMINO|PIZZA|STARBUCK|CAFE|RESTAUR|BAKERY|SWEET|TEA SHOP|HOTEL|FOOD|BARISTA|CHAAYOS/.test(u))return choose('Dining & food',merchant,'Food/restaurant merchant wording.');
 if(/APPLE SERV|APPLE MEDI|NETFLIX|ZEE5|SPOTIFY|YOUTUBE|HOTSTAR|SONYLIV|AMAZON PRIME|OPENAI|CHATGPT|GOOGLE.*STORAGE/.test(u))return choose('Subscriptions',/APPLE/.test(u)?'Apple services':/NETFLIX/.test(u)?'Netflix':/ZEE5/.test(u)?'Zee5':merchant,'Digital subscription merchant match.');
 if(/MEDIC|PHARMA|HOSPIT|GENERICO|RELIFE|SANJIVANI|DIAGNOST|CLINIC|WELLNESS FOREVER|APOLLO/.test(u))return choose('Health',merchant,'Healthcare/pharmacy wording in narration.');
 if(/CLEARTRIP|MAKEMYTRIP|IRCTC|UBER|OLA CABS|METRO|MAHA MUMBA|RED BUS|REDBUS|INDIGO|AIR INDIA|PETROL|FUEL|RAILWAY/.test(u))return choose('Transport & travel',/CLEARTRIP/.test(u)?'Cleartrip':/MAHA MUMBA/.test(u)?'Mumbai Metro':merchant,'Transport/travel merchant match.');
 if(/AIRTEL|JIO RECHARGE|RECHARGE|ELECTRIC|MSEDCL|ADANI POWER|TATA POWER|BROADBAND|MAHANAGAR GAS/.test(u))return choose('Utilities',merchant,'Utility/recharge merchant match.');
 if(/AMAZON|FLIPKART|MYNTRA|AJIO|DECATHLON|NYKAA|CROMA|MEESHO|UNIQLO|LENSKART|BOOKMYSHOW/.test(u))return choose('Shopping',/AMAZON/.test(u)?'Amazon':/FLIPKART/.test(u)?'Flipkart':/MYNTRA/.test(u)?'Myntra':merchant,'Shopping/entertainment merchant match.');
 if(/^RTGS|^NEFT|^MMT|^INF\/|^BIL\/INFT/.test(u))return choose('Transfers · review',debit>=1e5?'Large bank transfer':merchant,'Bank transfer with no clear purchase category. Review before counting as spending.',true);
 if(/^UPI\//.test(u)&&/BHARATPE|VYAPAR|PAYTMQR|RAZORPAY|\.RZP|PAY TO BHA|MERCHANT|@PTY|@YBL/.test(u))return choose('Merchant · review',merchant,'Merchant-style UPI narration; purchase category is unclear.',true);
 return choose(/^UPI\//.test(u)?'Transfers · review':'Uncategorized',merchant,'The narration alone does not establish the purpose.',true);
}
const headerNorm=x=>String(x||'').toLowerCase().replace(/[^a-z]/g,'');
export function detectMapping(rows){
 let best={score:-1,header:0,map:{}};
 rows.slice(0,100).forEach((row,i)=>{
  if(!Array.isArray(row))return;
  const hs=row.map(headerNorm);let map={};
  // Prefer transaction/posting dates to value dates even if value date appears first.
  const find=rs=>{for(const pattern of rs){const index=hs.findIndex(h=>pattern.test(h));if(index>=0)return index;}return -1;};
  map.date=find([/^(?:transaction|txn|tran|trans)date(?:time|ddmmyyyy|ddmmyy|ddmmmyyyy|ddmmmyy)?$/, /^(?:posted|posting|booking)date$/, /^date(?:ddmmyyyy|ddmmyy|ddmmmyyyy|ddmmmyy)?$/, /^valuedate$/]);
  map.description=find([/^(?:transaction|txn)?remarks?$/, /narration/, /description/, /particular/, /^(?:transaction|txn)?details?$/, /^merchant(?:name)?$/, /^payee(?:name)?$/, /^beneficiary(?:name)?$/]);
  map.debit=find([/^(?:debit|withdrawals?|withdraw)(?:amount|amt)?(?:inr|rs)?(?:dr)?$/, /^(?:debit|withdrawals?)(?:dr)(?:amount|amt)?(?:inr|rs)?$/, /^(?:moneyout|paidout)$/]);
  map.credit=find([/^(?:credit|deposits?)(?:amount|amt)?(?:inr|rs)?(?:cr)?$/, /^(?:credit|deposits?)(?:cr)(?:amount|amt)?(?:inr|rs)?$/, /^(?:moneyin|paidin)$/]);
  map.balance=find([/^(?:running|closing|ledger)?balance(?:amount|amt)?(?:inr|rs)?(?:crdr|drcr)?$/, /balance/]);
  map.amount=find([/^(?:(?:transaction|txn|signed)?amount|amt)(?:inr|rs)?$/, /^(?:debitcredit|creditdebit)amount(?:inr|rs)?$/]);
  map.type=find([/^(?:drcr|crdr|debitcredit|creditdebit)(?:flag|indicator)?$/, /^(?:transaction|txn)?type$/, /^(?:drcr|crdr)(?:type)?$/]);
  const score=(map.date>=0?5:0)+(map.description>=0?4:0)+(map.debit>=0?3:0)+(map.credit>=0?3:0)+(map.amount>=0?3:0)+(map.balance>=0?1:0);
  if(score>best.score)best={score,header:i,map};
 });return best;
}
export function hash(s){let h=2166136261,g=2246822519;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);g^=s.charCodeAt(i);g=Math.imul(g,3266489917);}return(h>>>0).toString(36)+'-'+(g>>>0).toString(36);}
export function parseRows(rows,options={}){
 const {header=0,map={},dateOrder='DMY',account='bank',sign='debit-positive',source='Statement',sourceId=hash(source),accountKey='Main bank'}=options;
 const output=[],counts={nonTransactions:0,invalid:0,zero:0,warnings:0},issues=[],schemaErrors=[],warnings=[],occurrences={};
 const mapped=k=>Number.isInteger(map[k])&&map[k]>=0;
 // Separate debit/credit columns are more specific than a generic Amount column.
 const singleAmount=mapped('amount')&&!mapped('debit')&&!mapped('credit');
 const active=['date','description',...(singleAmount?['amount','type']:['debit','credit']),'balance'].filter(mapped);
 if(!Array.isArray(rows)||!Number.isInteger(header)||header<0||header>=rows.length)schemaErrors.push('Choose a valid header row.');
 if(!mapped('date'))schemaErrors.push('Map a transaction date column.');
 if(!mapped('description'))schemaErrors.push('Map a description or narration column.');
 if(!singleAmount&&!mapped('debit')&&!mapped('credit'))schemaErrors.push('Map an amount column or separate debit/credit columns.');
 if(new Set(active.map(k=>map[k])).size!==active.length)schemaErrors.push('Each field must use a different source column.');
 const width=Array.isArray(rows)?rows.reduce((n,r)=>Math.max(n,Array.isArray(r)?r.length:0),0):0;
 if(active.some(k=>map[k]>=width))schemaErrors.push('A mapped column is outside the statement table.');
 if(!['DMY','MDY'].includes(dateOrder))schemaErrors.push('Choose day/month/year or month/day/year for dates.');
 if(!['debit-positive','credit-positive'].includes(sign))schemaErrors.push('Choose whether positive amounts are debits or credits.');
 if(schemaErrors.length)return {transactions:output,counts,totalRows:Array.isArray(rows)?rows.length:0,issues,schemaErrors,warnings};
 const addIssue=(row,code,reason,severity='error')=>{issues.push({row,code,reason,severity});if(severity==='error')counts.invalid++;else counts.warnings++;};
 const summaryText=v=>/^(?:opening balance|closing balance|balance brought forward|balance carried forward|brought forward|carried forward|statement totals?|grand totals?|totals?|end of statement|page \d+(?: of \d+)?)\s*[:.-]?$/i.test(String(v??'').trim());
 const direction=v=>{const s=String(v??'').trim().toLowerCase().replace(/[.]/g,'');return /^(?:c|cr|credit|deposit|refund|paid in|money in)$/.test(s)?'credit':/^(?:d|dr|db|debit|withdrawal|purchase|paid out|money out)$/.test(s)?'debit':null;};
 let ambiguousDates=0;
 rows.slice(header+1).forEach((r,offset)=>{
  const row=header+offset+2;
  if(!Array.isArray(r)||!r.some(x=>x!==null&&x!==''&&x!==undefined)){counts.nonTransactions++;return;}
  const repeatedHeader=headerNorm(r[map.date])&&headerNorm(r[map.date])===headerNorm(rows[header][map.date])&&headerNorm(r[map.description])===headerNorm(rows[header][map.description]);
  const date=parseDate(r[map.date],dateOrder),amountKeys=singleAmount?['amount']:['debit','credit'].filter(mapped);
  if(repeatedHeader||(!date&&(summaryText(r[map.date])||summaryText(r[map.description])))){counts.nonTransactions++;return;}
  if(!date){
   const monetaryData=amountKeys.some(k=>!missingAmount(r[map[k]]));
   if(monetaryData)addIssue(row,'invalid-date','Transaction date is missing or invalid for the selected date format.');
   else counts.nonTransactions++;
   return;
  }
  let debit=0,credit=0;
  if(singleAmount){
   const raw=r[map.amount],v=parseAmount(raw);if(v===null){addIssue(row,'invalid-amount','Amount is missing or not a valid INR number.');return;}
   const flag=mapped('type')?String(r[map.type]??'').trim():'',flagDirection=direction(flag),markerDirection=direction(amountMarker(raw));
   if(flag&&!flagDirection){addIssue(row,'invalid-direction','Debit/credit flag is unrecognized; correct the flag mapping or leave it unmapped and choose the amount sign.');return;}
   if(flagDirection&&markerDirection&&flagDirection!==markerDirection){addIssue(row,'conflicting-direction','Amount and debit/credit flag give conflicting directions.');return;}
   const chosen=flagDirection||markerDirection;
   if(chosen==='credit')credit=Math.abs(v);else if(chosen==='debit')debit=Math.abs(v);else if(sign==='debit-positive'){debit=v>0?v:0;credit=v<0?-v:0;}else{debit=v<0?-v:0;credit=v>0?v:0;}
  }else{
   if(amountKeys.every(key=>missingAmount(r[map[key]]))){addIssue(row,'missing-amount','Debit and credit are both missing for this dated row.');return;}
   const values={};let invalid=false;
   for(const key of amountKeys){
    const raw=r[map[key]],marker=direction(amountMarker(raw));
    if(marker&&marker!==key){addIssue(row,'conflicting-direction',`${key==='debit'?'Debit':'Credit'} column contains the opposite debit/credit marker. Check the column mapping.`);invalid=true;break;}
    const value=missingAmount(raw)?0:parseAmount(withoutAmountMarker(raw));
    if(value===null){addIssue(row,'invalid-amount',`${key==='debit'?'Debit':'Credit'} is not a valid INR number.`);invalid=true;break;}
    values[key]=value;
   }
   if(invalid)return;
   const d=values.debit||0,c=values.credit||0;debit=Math.max(d,0)+Math.max(-c,0);credit=Math.max(c,0)+Math.max(-d,0);
  }
  if(!debit&&!credit){counts.zero++;return;}
  if(debit&&credit){addIssue(row,'two-directions','Both debit and credit are nonzero; verify the mapped columns.');return;}
  const description=String(r[map.description]??'').trim();if(!description){addIssue(row,'missing-description','Transaction description is missing.');return;}
  const balance=mapped('balance')?parseAmount(r[map.balance]):null;
  if(mapped('balance')&&!missingAmount(r[map.balance])&&balance===null)addIssue(row,'invalid-balance','Running balance could not be read; the transaction is retained without a balance.', 'warning');
  const numericDate=String(r[map.date]??'').trim().match(/^(\d{1,2})[-/.,](\d{1,2})[-/.,](?:\d{2}|\d{4})(?:\s|$)/);
  if(numericDate&&+numericDate[1]<=12&&+numericDate[2]<=12&&+numericDate[1]!==+numericDate[2])ambiguousDates++;
  const fingerprint=[accountKey,account,date,description.toLowerCase().replace(/\s+/g,' '),debit.toFixed(2),credit.toFixed(2),balance??''].join('|');
  occurrences[fingerprint]=(occurrences[fingerprint]||0)+1;
  output.push({id:hash(fingerprint)+'-'+occurrences[fingerprint],date,description:sanitizeDescription(description),debit,credit,balance,account,accountKey,source,sourceId,row,...identify(description,debit,credit)});
 });
 if(ambiguousDates)warnings.push(`${ambiguousDates} date${ambiguousDates===1?' is':'s are'} ambiguous. Using ${dateOrder==='MDY'?'month/day/year':'day/month/year'}; confirm this matches the statement.`);
 if(counts.warnings)warnings.push(`${counts.warnings} transaction balance${counts.warnings===1?' could':'s could'} not be read. Review the source rows listed below.`);
 return {transactions:output,counts,totalRows:rows.length,issues,schemaErrors,warnings};
}
export function reconcile(ts){
 const list=ts.filter(t=>t.account==='bank'&&Number.isFinite(t.balance));
 if(!list.length)return {available:false,count:0,errors:[],opening:null,closing:null};
 const check=ordered=>{let opening=ordered[0].balance+ordered[0].debit-ordered[0].credit,prev=opening,errors=[];for(const t of ordered){const expected=Math.round((prev-t.debit+t.credit)*100)/100;if(Math.abs(expected-t.balance)>.011)errors.push({row:t.row,expected,actual:t.balance,difference:+(t.balance-expected).toFixed(2)});prev=t.balance;}return {available:true,count:list.length,opening:+opening.toFixed(2),closing:prev,errors,net:+(sum(ordered,'credit')-sum(ordered,'debit')).toFixed(2)};};
 const normal=check(list),reverse=check([...list].reverse());return reverse.errors.length<normal.errors.length?reverse:normal;
}
export function effective(t,overrides={},rules={}){
 const rule=rules[t.merchant+'|'+(t.debit?'debit':'credit')];
 const category=overrides[t.id]||rule||t.category;
 return {...t,category,review:overrides[t.id]||rule?false:t.review,classification:overrides[t.id]||rule?'Edited':t.classification};
}
export function mergeTransactions(existing,incoming){const ids=new Set(existing.map(t=>t.id)),fresh=[];let duplicate=0;for(const t of incoming){if(ids.has(t.id)){duplicate++;}else{ids.add(t.id);fresh.push(t);}}return {transactions:[...existing,...fresh],added:fresh.length,duplicate};}
export function monthsBetween(from,to){if(!from||!to||from>to)return[];let[y,m]=from.slice(0,7).split('-').map(Number),last=to.slice(0,7),out=[];for(let i=0;i<1200;i++){const key=`${y}-${pad(m)}`;if(key>last)break;out.push(key);if(++m===13){m=1;y++;}}return out;}
export function grouped(ts,key,amount='debit'){const map=new Map;for(const t of ts){const k=typeof key==='function'?key(t):t[key];if(!map.has(k))map.set(k,{key:k,total:0,count:0,rows:[]});const v=map.get(k);v.total+=typeof amount==='function'?amount(t):t[amount]||0;v.count++;v.rows.push(t);}return [...map.values()].map(x=>({...x,total:+x.total.toFixed(2)})).sort((a,b)=>b.total-a.total);}
export function stats(ts){const bank=ts.filter(t=>t.account==='bank');const spend=ts.filter(t=>t.debit>0&&CATEGORIES[t.category]?.expense);return {bankDebit:sum(bank,'debit'),bankCredit:sum(bank,'credit'),expense:sum(spend,'debit'),expenseCount:spend.length,unresolved:sum(ts.filter(t=>t.review&&t.debit),'debit'),reviewCount:ts.filter(t=>t.review&&t.debit).length,cardSettlements:sum(ts.filter(t=>t.category==='Credit card payments'),'debit'),count:ts.length};}
export function recurring(ts){return grouped(ts.filter(t=>t.debit>0&&!t.review&&t.category!=='Property payments'&&t.category!=='Transfers · review'), 'merchant').map(g=>{const months=new Set(g.rows.map(t=>t.date.slice(0,7))),values=g.rows.map(t=>t.debit).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)];const consistent=g.rows.filter(t=>Math.abs(t.debit-median)<=median*.15).length/g.rows.length;return {...g,months:months.size,median,consistent};}).filter(g=>g.months>=3&&g.consistent>=.65).sort((a,b)=>b.months-a.months||b.total-a.total);}
