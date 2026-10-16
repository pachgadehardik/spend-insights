import {parseAmount,sum} from './core.mjs';
// Totals supplied by the user are independent of the inferred running balance.
export function verifyStatement(rows,expected={}){
  const errors=[],checks=[];
  for(const [key,label] of [['debit','Total debits'],['credit','Total credits'],['count','Transaction count']]){
    if(expected[key]===undefined||String(expected[key]).trim()==='')continue;
    const value=key==='count'?Number(expected[key]):parseAmount(expected[key]);
    const actual=key==='count'?rows.length:sum(rows,key);
    if(!Number.isFinite(value)||value<0||(key==='count'&&!Number.isInteger(value)))errors.push(label+' must be a valid non-negative '+(key==='count'?'whole number.':'amount.'));
    else if(Math.round(actual*100)!==Math.round(value*100))errors.push(`${label} does not match the statement value you entered.`);
    else checks.push(label+' matches');
  }
  return {errors,checks,provided:checks.length+errors.length};
}
