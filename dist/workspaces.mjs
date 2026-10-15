export const LEGACY_KEY='hardik-spend-insights-v1';
export const WORKSPACES_KEY='spend-insights-workspaces-v1';
export const emptyAnalysis=()=>({version:1,transactions:[],sources:[],overrides:{},rules:{}});
export const dataKey=id=>id==='personal'?LEGACY_KEY:'spend-insights-analysis-'+id;
export function readWorkspaces(storage){try{const x=JSON.parse(storage.getItem(WORKSPACES_KEY));if(x&&Array.isArray(x.items)&&x.items.length&&x.items.every(i=>typeof i.id==='string'&&/^[a-zA-Z0-9-]+$/.test(i.id)&&typeof i.name==='string')&&x.items.some(i=>i.id===x.active))return x;}catch{}return {active:'personal',items:[{id:'personal',name:'My spending'}]};}
