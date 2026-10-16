import {compact} from './core.mjs';
const idOf=(kind,key)=>JSON.stringify([kind,key]);
export const accountKey=t=>JSON.stringify([t.account,t.accountKey]);

export function knowledgeGraph(rows,{direction='debit',semantic=false,focus=null,expanded=false}={}){
  const nodes=new Map(),edges=new Map();
  const node=(kind,key,label,t)=>{const id=idOf(kind,key);if(!nodes.has(id))nodes.set(id,{id,kind,key,label,ids:[],amount:0});const n=nodes.get(id);n.ids.push(t.id);n.amount+=t[direction]||0;return id;};
  const edge=(source,target,t,suggested=false)=>{const id=JSON.stringify([source,target]);if(!edges.has(id))edges.set(id,{id,source,target,ids:[],amount:0,suggested:false});const x=edges.get(id);x.ids.push(t.id);x.amount+=t[direction]||0;x.suggested ||= suggested;};
  for(const t of rows){const a=node('account',accountKey(t),`${t.accountKey} · ${t.account==='card'?'card':'bank'}`,t),m=node('merchant',t.merchant,t.merchant,t),c=node('category',t.category,t.category,t);edge(a,m,t);edge(m,c,t,t.classification!=='Edited');}
  const limits={account:4,merchant:expanded?14:8,category:expanded?9:5};
  const selected=nodes.get(focus),selectedIds=selected?new Set(selected.ids):null;
  const visible=[];
  for(const kind of ['account','merchant','category']){
    const list=[...nodes.values()].filter(n=>n.kind===kind).sort((a,b)=>(b.id===focus)-(a.id===focus)||(selectedIds?Number(b.ids.some(id=>selectedIds.has(id)))-Number(a.ids.some(id=>selectedIds.has(id))):0)||b.amount-a.amount||a.label.localeCompare(b.label));
    visible.push(...list.slice(0,limits[kind]));
  }
  const shownIds=new Set(visible.map(n=>n.id)),links=[...edges.values()].filter(x=>shownIds.has(x.source)&&shownIds.has(x.target));
  const complete=rows.filter(t=>shownIds.has(idOf('account',accountKey(t)))&&shownIds.has(idOf('merchant',t.merchant))&&shownIds.has(idOf('category',t.category))).length;
  const height=Math.max(600,Math.ceil(visible.filter(n=>n.kind==='merchant').length/2)*110+130,visible.filter(n=>n.kind==='category').length*85+130);
  // Kind-based slots are deterministic; keyed SVG elements animate between slots.
  for(const kind of ['account','merchant','category']){
    const list=visible.filter(n=>n.kind===kind).sort((a,b)=>a.label.localeCompare(b.label));
    list.forEach((n,i)=>{n.x=kind==='account'?100:kind==='merchant'?(i%2?500:320):730;n.y=75+(kind==='merchant'?(Math.floor(i/2)+.5)*(height-160)/Math.ceil(list.length/2):(i+.5)*(height-160)/Math.max(list.length,1));n.r=kind==='merchant'?28:23;n.sub=compact(n.amount);n.active=!selectedIds||n.ids.some(id=>selectedIds.has(id));});
  }
  if(semantic&&visible.length){const id='semantic-query';visible.push({id,kind:'query',key:id,label:'Suggested matches',sub:'EmbeddingGemma',x:410,y:34,r:16,ids:rows.map(t=>t.id),active:true});for(const n of visible.filter(n=>n.kind==='merchant'))links.push({id:id+n.id,source:id,target:n.id,ids:n.ids,amount:0,suggested:true,semantic:true});}
  for(const link of links)link.active=!selectedIds||link.ids.some(id=>selectedIds.has(id));
  return {nodes:visible,links,height,hidden:nodes.size-(semantic?visible.length-1:visible.length),complete,total:rows.length,selected,selectedRows:selectedIds?rows.filter(t=>selectedIds.has(t.id)):rows};
}

const NS='http://www.w3.org/2000/svg';
const element=(tag,attrs={})=>{const x=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,v);return x;};
export class GraphCanvas {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.zoom=1;this.pan={x:0,y:0};this.positions=new Map();
    this.svg=element('svg',{viewBox:'0 0 830 600',role:'group','aria-label':'Interactive knowledge graph. Tab to a node and press Enter to select it.'});
    this.camera=element('g');this.lines=element('g');this.circles=element('g');this.camera.append(this.lines,this.circles);this.svg.append(this.camera);host.replaceChildren(this.svg);
    this.svg.addEventListener('click',e=>{const g=e.target.closest('[data-node]');if(g)this.onSelect(g.getAttribute('data-node'));});
    this.svg.addEventListener('keydown',e=>{const g=e.target.closest('[data-node]');if(g&&['Enter',' '].includes(e.key)){e.preventDefault();this.onSelect(g.getAttribute('data-node'));}});
    this.svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-node]'))return;this.drag={x:e.clientX,y:e.clientY,px:this.pan.x,py:this.pan.y};this.svg.setPointerCapture(e.pointerId);});
    this.svg.addEventListener('pointermove',e=>{if(!this.drag)return;const scale=830/this.svg.getBoundingClientRect().width;this.pan={x:this.drag.px+(e.clientX-this.drag.x)*scale,y:this.drag.py+(e.clientY-this.drag.y)*scale};this.transform();});
    for(const event of ['pointerup','pointercancel'])this.svg.addEventListener(event,()=>this.drag=null);
  }
  transform(){this.camera.setAttribute('transform',`translate(${415*(1-this.zoom)+this.pan.x} ${300*(1-this.zoom)+this.pan.y}) scale(${this.zoom})`);}
  scale(delta){this.zoom=Math.max(.65,Math.min(2,this.zoom+delta));this.transform();}
  reset(){this.zoom=1;this.pan={x:0,y:0};this.transform();}
  update(graph,focus){
    this.svg.setAttribute('viewBox',`0 0 830 ${graph.height}`);
    const old=new Map([...this.circles.children].map(g=>[g.getAttribute('data-node'),g]));
    const loc=new Map(graph.nodes.map(n=>[n.id,n]));this.lines.replaceChildren();
    for(const link of graph.links){const a=loc.get(link.source),b=loc.get(link.target),p=element('path',{d:`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2-20} ${b.x} ${b.y}`,class:`kg-edge ${link.suggested?'suggested':''} ${link.semantic?'semantic':''} ${link.active?'':'dim'}`,'stroke-width':link.semantic?1.4:1.2+Math.min(5,Math.sqrt(link.ids.length)/2)});const title=element('title');title.textContent=`${a.label} → ${b.label}: ${link.ids.length} supporting rows${link.suggested?' · suggested relationship':''}`;p.append(title);this.lines.append(p);}
    for(const n of graph.nodes){let g=old.get(n.id),fresh=!g;if(g)old.delete(n.id);else {g=element('g',{'data-node':n.id,role:'button',tabindex:'0'});g.append(element('circle'),element('text',{class:'kg-node-glyph','text-anchor':'middle',y:5}),element('text',{class:'kg-node-label','text-anchor':'middle'}),element('text',{class:'kg-node-sub','text-anchor':'middle'}),element('title'));this.circles.append(g);}
      g.setAttribute('class',`kg-node ${n.kind} ${n.active?'':'dim'} ${focus===n.id?'selected':''}`);g.setAttribute('aria-pressed',String(focus===n.id));g.setAttribute('aria-label',`${n.kind}: ${n.label}, ${n.ids.length} transactions, ${n.sub}`);
      g.children[0].setAttribute('r',n.r);g.children[1].textContent=({account:'▤',merchant:'↗',category:'◇',query:'⌕'})[n.kind];
      g.children[2].setAttribute('y',n.r+17);g.children[2].textContent=n.label.length>24?n.label.slice(0,22)+'…':n.label;
      g.children[3].setAttribute('y',n.r+33);g.children[3].textContent=n.sub;g.children[4].textContent=n.label;
      g.style.transform=`translate(${n.x}px, ${n.y}px)`;if(fresh)g.classList.add('entering');
    }
    for(const g of old.values())g.remove();
  }
}
