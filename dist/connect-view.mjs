import {escapeHTML as e,preciseMoney as money} from './core.mjs';
import {planQuestion,executeQuestion,semanticDocuments,groupKey} from './query-engine.mjs';
import {knowledgeGraph,GraphCanvas} from './knowledge-graph.mjs';
import {SemanticClient} from './semantic-client.mjs';

const starters=['Where do I spend most?','Which recurring expenses increased this month?','What needs a closer look?'];
const followups=['Only my credit card','Compare with last month','Show all history'];
export class ConnectionExplorer{
  constructor(){this.semantic=new SemanticClient();this.history=[];this.serial=0;this.status='';this.busy=false;this.expanded=false;}
  dispose(){this.serial++;this.semantic.stop();this.rows=[];this.history=[];this.result=null;this.signature=null;this.status='';this.busy=false;this.focus=null;this.root=null;this.canvas=null;}
  render(rows,context){
    const signature=context+'|'+JSON.stringify(rows.map(t=>[t.id,t.category,t.merchant,t.debit,t.credit,t.review]));
    if(signature!==this.signature){this.signature=signature;this.serial++;this.rows=rows;this.history=[];this.focus=null;this.busy=false;this.status='';this.semantic.clear();this.result=executeQuestion(rows,planQuestion('Where do I spend most?',rows));}
    return `<section class="connect explorer" aria-label="Ask your statement"><div class="kg-intro"><div><span class="ex-kicker">A QUESTION. A CONNECTION. THE EVIDENCE.</span><h2>Ask. Follow. Understand.</h2><p>Your questions bring the relevant part of your money into focus.</p></div><span class="ex-local-badge"><span></span>On your device · INR</span></div><div class="kg-workbench"><aside class="kg-chat"><div class="kg-chat-head"><h3>Ask your data</h3><button type="button" data-kg="reset" title="Start a fresh conversation">New chat ↺</button></div><div class="kg-messages" id="kg-messages" aria-live="polite" aria-relevant="additions"></div><div id="kg-status" class="kg-status" role="status"></div><form id="kg-form"><label class="ex-sr-only" for="kg-question">Ask about your statement</label><textarea id="kg-question" rows="2" maxlength="500" placeholder="What changed in my spending?"></textarea><div class="kg-composer-bottom"><span>Enter to ask · Shift + Enter for a line</span><button type="submit" aria-label="Ask question">↑</button></div></form><div class="kg-model" id="kg-model"></div><details class="kg-help"><summary>What can I ask?</summary><p>Ask about totals, largest merchants or categories, recurring candidates, payments needing review, and month-to-month changes. Name a merchant, category, account, or month (for example September 2026).</p><p>Follow up with “Only my credit card” or “Compare with last month”. Relative months refer to your latest statement. Every question also respects the filters above.</p><p>Semantic search finds related descriptions. Answers and arithmetic use fixed, inspectable calculations; this version has no generative chat model. It cannot answer every kind of question.</p></details></aside><section class="kg-map"><div class="kg-map-top"><div><span class="ex-kicker">LIVE CONNECTIONS</span><h3 id="kg-map-title">Your spending neighborhood</h3></div><div class="kg-map-controls"><button data-kg="zoom-out" aria-label="Zoom out">−</button><button data-kg="zoom-in" aria-label="Zoom in">+</button><button data-kg="fit">Fit</button><button data-kg="expand">More nodes</button></div></div><div id="kg-scope" class="kg-scope"></div><div class="kg-canvas" id="kg-canvas"></div><div id="kg-node-list" class="kg-node-list"></div><div class="kg-legend"><span><i></i>Shared statement rows</span><span><i class="dashed"></i>Suggested category / semantic match</span><span>Drag the background to pan</span></div><p class="kg-coverage" id="kg-coverage"></p><div class="kg-evidence" id="kg-evidence"></div></section></div></section>`;
  }
  mount(root){
    this.root=root;this.canvas=new GraphCanvas(root.querySelector('#kg-canvas'),id=>{this.focus=this.focus===id?null:id;this.drawGraph();});
    root.querySelector('#kg-form').addEventListener('submit',ev=>{ev.preventDefault();this.ask(root.querySelector('#kg-question').value);});
    root.querySelector('#kg-question').addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();this.ask(ev.target.value);}});
    root.addEventListener('click',ev=>{const button=ev.target.closest('button');if(!button)return;
      if(button.dataset.ask){this.ask(button.dataset.ask);return;}
      if(button.dataset.kgFocus){this.focus=button.dataset.kgFocus;this.drawGraph();return;}
      if(button.dataset.kgEvidence){this.focus=JSON.stringify(['merchant',this.result.rows.find(t=>t.id===button.dataset.kgEvidence)?.merchant]);this.drawGraph();return;}
      if(button.dataset.kgRemove){const plan={...this.result.plan,semanticKeys:this.result.plan.semanticKeys.filter(k=>k!==button.dataset.kgRemove)};this.result=executeQuestion(this.rows,plan);this.history[this.history.length-1].result=this.result;this.focus=null;this.draw();return;}
      switch(button.dataset.kg){
        case'enable':this.enable();break;
        case'cancel':this.serial++;this.busy=false;this.semantic.stop();this.status='Stopped. Structured questions are ready.';this.draw();break;
        case'reset':this.serial++;this.history=[];this.focus=null;this.busy=false;this.status='';this.result=executeQuestion(this.rows,planQuestion('Where do I spend most?',this.rows));this.draw();break;
        case'zoom-in':this.canvas.scale(.2);break;case'zoom-out':this.canvas.scale(-.2);break;case'fit':this.canvas.reset();break;
        case'expand':this.expanded=!this.expanded;button.textContent=this.expanded?'Fewer nodes':'More nodes';this.drawGraph();break;
        case'clear-focus':this.focus=null;this.drawGraph();break;
      }
    });this.draw();
  }
  progress(message){this.status=message;if(this.root?.isConnected){this.root.querySelector('#kg-status').textContent=message;}}
  async enable(){if(this.busy)return;const serial=++this.serial;this.busy=true;this.status='Opening EmbeddingGemma 2…';this.draw();try{await this.semantic.request('load',{},message=>{if(serial===this.serial)this.progress(message);});if(serial!==this.serial)return;this.status='Semantic search is ready. Your data stays on this device.';}catch(error){if(serial!==this.serial)return;this.status=error.message;}finally{if(serial===this.serial){this.busy=false;this.draw();}}}
  async ask(question){
    question=String(question).trim().slice(0,500);if(!question||this.busy)return;
    const serial=++this.serial;this.busy=true;this.focus=null;this.status='Following the connections…';
    const plan=planQuestion(question,this.rows,[...this.history].reverse().find(t=>t.result&&!t.result.error)?.result?.plan);
    const turn={question,result:null};this.history.push(turn);if(this.history.length>8)this.history.shift();
    this.root.querySelector('#kg-question').value='';this.draw();
    try{
      if(!plan.error&&plan.semanticText){
        if(!this.semantic.ready){turn.result={plan,rows:[],error:`“${plan.semanticText}” needs semantic matching. Enable EmbeddingGemma below, then ask again. You can also ask about a named merchant/category or use the suggested questions.`};this.status='';}
        else{
          const documents=semanticDocuments(this.rows.filter(t=>t[plan.direction]>0));
          const {matches}=await this.semantic.request('search',{documents,query:question},message=>{if(serial===this.serial)this.progress(message);});if(serial!==this.serial)return;
          const best=matches[0]?.score||0;plan.semanticKeys=matches.filter(m=>m.score>=Math.max(.3,best-.08)).slice(0,5).map(m=>m.key);
          turn.result=executeQuestion(this.rows,plan);this.status=plan.semanticKeys.length?'Semantic groups found. Check their relevance below.':'No sufficiently similar groups found. Try different wording.';
        }
      }else{turn.result=executeQuestion(this.rows,plan);this.status='';}
      if(serial!==this.serial)return;
      this.result=turn.result;
    }catch(error){if(serial!==this.serial)return;turn.result={plan,rows:[],error:error.message};this.result=turn.result;this.status='';}
    finally{if(serial===this.serial){this.busy=false;this.draw();this.root?.querySelector('#kg-question')?.focus();}}
  }
  answer(result,index){
    if(!result)return '<div class="kg-thinking">Following the connections<span>···</span></div>';
    if(result.error)return `<p class="kg-answer-error">${e(result.error)}</p>${result.plan?.semanticText?`<button class="kg-retry" data-ask="${e(result.plan.question)}">Try this question again ↗</button>`:''}`;
    const active=index===this.history.length-1;
    return `<p>${e(result.text)}</p>${result.rows.length?`<div class="kg-answer-totals">${result.metrics.map(m=>`<div><span>${m.account==='bank'?'Bank':'Card'} ${result.plan.direction==='credit'?'credits':'debits'}</span><b>${money(m.current)}</b>${result.plan.compare?`<small>was ${money(m.previous)}</small>`:''}</div>`).join('')}</div>`:''}
      ${result.groups?.length?`<ol class="kg-answer-groups">${result.groups.slice(0,4).map((g,i)=>`<li><button ${active?`data-kg-focus="${e(JSON.stringify([result.plan.group,g.key]))}"`:'disabled'}><span><i>[${i+1}]</i>${e(g.key)}</span><b>${result.plan.compare?(g.delta>=0?'+':'−')+money(Math.abs(g.delta)):money(g.total)}</b></button></li>`).join('')}</ol>`:''}
      ${result.semantic&&active?`<div class="kg-match-list"><span>Suggested groups · remove any unrelated match</span>${[...new Map(result.rows.map(t=>[groupKey(t),t])).entries()].map(([key,t])=>`<button data-kg-remove="${e(key)}" title="Remove ${e(t.merchant)} from this answer">${e(t.merchant)} · ${e(t.category)} ×</button>`).join('')}</div>`:''}
      ${result.notes.length?`<details class="kg-answer-notes"><summary>How this answer was calculated</summary>${result.notes.map(n=>`<p>${e(n)}</p>`).join('')}<p>Scope: ${e(result.scope.join(' · '))}. All matching rows are included in the amounts. The graph and evidence list show a smaller selection.</p></details>`:''}`;
  }
  draw(){
    if(!this.root?.isConnected)return;
    const messages=this.root.querySelector('#kg-messages');messages.innerHTML=this.history.length?this.history.map((h,i)=>`<article class="kg-turn"><div class="kg-question-bubble">${e(h.question)}</div><div class="kg-answer"><span class="kg-answer-label">${h.result?.semantic?'SEMANTIC MATCHES + EXACT CALCULATIONS':'STATEMENT ANSWER'}</span>${this.answer(h.result,i)}</div></article>`).join(''):`<div class="kg-welcome"><span class="kg-welcome-mark">⌁</span><h3>What would you like to understand?</h3><p>Ask a question and watch the connections come into focus. Every amount leads back to a payment.</p></div><div class="kg-starters">${starters.map(q=>`<button data-ask="${e(q)}">${e(q)} <span>↗</span></button>`).join('')}</div>`;
    if(this.history.length&&!this.busy)messages.insertAdjacentHTML('beforeend',`<div class="kg-followups">${followups.map(q=>`<button data-ask="${e(q)}">${e(q)}</button>`).join('')}</div>`);
    messages.scrollTop=messages.scrollHeight;
    this.root.querySelector('#kg-status').textContent=this.status;
    this.root.querySelector('#kg-question').disabled=this.busy;this.root.querySelector('[type=submit]').disabled=this.busy;
    this.root.querySelector('#kg-model').innerHTML=this.busy?'<span>Processing on this device</span><button data-kg="cancel">Cancel</button>':this.semantic.ready?'<span class="kg-ready">● EmbeddingGemma 2 ready · local</span>':'<div><b>Search by meaning</b><p>Enable EmbeddingGemma 2 · ~207 MB model download plus 26 MB runtime, cached by your browser. Model files come from Hugging Face; statement data stays here. Requires WebGPU.</p></div><button data-kg="enable">Enable semantic search ↗</button>';
    this.drawGraph();
  }
  drawGraph(){
    if(!this.root?.isConnected)return;
    const result=this.result,graph=knowledgeGraph(result?.rows||[],{direction:result?.plan.direction,semantic:result?.semantic,focus:this.focus,expanded:this.expanded});
    this.canvas.update(graph,this.focus);
    this.root.querySelector('#kg-node-list').innerHTML='<span>Tap a connection</span>'+graph.nodes.filter(n=>n.kind!=='query').map(n=>`<button data-kg-focus="${e(n.id)}" aria-pressed="${this.focus===n.id}">${e(n.label)} <b>${e(n.sub)}</b></button>`).join('');
    this.root.querySelector('#kg-map-title').textContent=this.focus&&graph.selected?graph.selected.label:this.history.length?'Connections behind your answer':'Your spending neighborhood';
    this.root.querySelector('#kg-scope').innerHTML=(result?.scope||['Ask a question to find connections']).map(s=>`<span>${e(s)}</span>`).join('');
    this.root.querySelector('#kg-coverage').textContent=graph.total?`${graph.complete} of ${graph.total} matching rows have their complete path visible. ${graph.hidden} nodes outside this view. Select an answer reference to focus a group; amounts always include all matching rows.`:'No graph to show for this question. Try a suggested question or adjust the filters.';
    const evidence=[...graph.selectedRows].sort((a,b)=>(b[result?.plan.direction]||0)-(a[result?.plan.direction]||0));
    this.root.querySelector('#kg-evidence').innerHTML=`<div class="kg-evidence-heading"><div><span class="ex-kicker">FOLLOW THE EVIDENCE</span><h3>${graph.selected?e(graph.selected.label):'Payments behind these connections'}</h3></div>${this.focus?'<button data-kg="clear-focus">All answer connections ↺</button>':''}</div><div class="kg-receipts">${evidence.slice(0,6).map(t=>`<button data-detail="${e(t.id)}" class="kg-receipt"><span><b>${e(t.merchant)}</b><strong>${money(t[result.plan.direction])}</strong></span><small>${e(t.date)} · ${e(t.accountKey)} · ${e(t.category)}</small><small>${e(t.source)} · ${t.sourcePage?'page '+e(t.sourcePage)+' · ':''}row ${e(t.row)} <i>↗</i></small></button>`).join('')||'<p class="small-muted">Matching transactions will appear here.</p>'}</div>${evidence.length>6?`<p class="kg-coverage">Largest 6 of ${evidence.length} supporting transactions shown. Open Transactions for the full table.</p>`:''}`;
  }
}
