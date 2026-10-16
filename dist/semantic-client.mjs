export class SemanticClient{
  constructor(){this.worker=null;this.pending=new Map();this.seq=0;this.ready=false;}
  request(type,data={},onProgress=()=>{}){
    if(!this.worker){this.worker=new Worker(new URL('./semantic-worker.mjs',import.meta.url),{type:'module'});this.worker.onmessage=({data:m})=>{const p=this.pending.get(m.id);if(!p)return;if(m.type==='progress'){p.progress(m.message);return;}clearTimeout(p.timer);this.pending.delete(m.id);if(m.type==='error')p.reject(Error(m.message));else{if(m.type==='ready')this.ready=true;p.resolve(m);}};this.worker.onerror=()=>this.stop('The model worker could not start. Check your connection, then try again.');}
    const id=++this.seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.stop('The model took too long. Try again on a faster connection or device.'),600000);this.pending.set(id,{resolve,reject,progress:onProgress,timer});this.worker.postMessage({id,type,...data});});
  }
  clear(){if(this.worker)this.worker.postMessage({id:++this.seq,type:'clear'});}
  stop(message='Model operation cancelled.'){this.worker?.terminate();this.worker=null;this.ready=false;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message));}this.pending.clear();}
}
