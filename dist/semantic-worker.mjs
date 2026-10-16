import {env,AutoConfig,AutoTokenizer,AutoModel} from './vendor/transformers/transformers.min.js';
const MODEL='onnx-community/embeddinggemma-2-ONNX';
const REVISION='daa72c51243991dfcaf9f9137d2c573d8f7790c0';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.numThreads=1;
let model,tokenizer,loading,index=new Map();
const send=(id,type,extra={})=>postMessage({id,type,...extra});
const normalized=row=>{const a=Array.from(row).slice(0,256);const length=Math.hypot(...a);if(!Number.isFinite(length)||!length)throw Error('The model produced an invalid embedding.');return a.map(v=>v/length);};
async function load(id){
  if(model)return;
  if(loading)return loading;
  loading=(async()=>{
    if(!self.navigator?.gpu)throw Error('Semantic search needs a browser with WebGPU. Try a recent desktop Chrome or Edge. Structured questions still work.');
    const adapter=await self.navigator.gpu.requestAdapter();if(!adapter)throw Error('WebGPU is unavailable on this device. Structured questions still work.');
    const progress_callback=p=>{if(p.status==='progress')send(id,'progress',{message:`Downloading model · ${p.file} · ${Math.round(p.progress||0)}%`});};
    const config=await AutoConfig.from_pretrained(MODEL,{revision:REVISION});config.vision_config=null;config.audio_config=null;
    tokenizer=await AutoTokenizer.from_pretrained(MODEL,{revision:REVISION,progress_callback});
    model=await AutoModel.from_pretrained(MODEL,{revision:REVISION,config,device:'webgpu',dtype:'q4',progress_callback});
    // Warm-up proves the loaded runtime can actually produce finite embeddings.
    await embed(['task: search result | query: payments']);
  })();
  try{await loading;}catch(e){model=null;tokenizer=null;loading=null;throw e;}
}
async function embed(texts){const inputs=await tokenizer(texts,{padding:true,truncation:true,max_length:256});const output=await model(inputs);const values=output.sentence_embedding.tolist().map(normalized);for(const v of Object.values(output))v?.dispose?.();return values;}
async function handle({id,type,documents,query}){
  if(type==='clear'){index.clear();return;}
  await load(id);
  if(type==='load'){send(id,'ready');return;}
  const missing=documents.filter(d=>!index.has(d.text));
  for(let i=0;i<missing.length;i+=4){const batch=missing.slice(i,i+4),vectors=await embed(batch.map(d=>d.text));batch.forEach((d,j)=>index.set(d.text,vectors[j]));send(id,'progress',{message:`Connecting your data · ${Math.min(i+4,missing.length)} of ${missing.length} groups`});}
  const [q]=await embed(['task: search result | query: '+query]);
  const matches=documents.map(d=>({key:d.key,score:index.get(d.text).reduce((s,v,i)=>s+v*q[i],0)})).sort((a,b)=>b.score-a.score);
  send(id,'result',{matches:matches.slice(0,8)});
}
let queue=Promise.resolve();self.onmessage=event=>{queue=queue.then(()=>handle(event.data)).catch(error=>send(event.data.id,'error',{message:error.message||'The local model could not run. Try again or use a structured question.'}));};
