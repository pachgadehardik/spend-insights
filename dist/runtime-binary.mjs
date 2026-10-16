// Reassemble the pinned runtime locally. Each asset fits the host's 25 MiB limit.
const FILE='ort-wasm-simd-threaded.asyncify.wasm';
export async function loadRuntimeBinary(){
  const parts=await Promise.all([1,2].map(async part=>{
    const response=await fetch(new URL(`./vendor/onnx/${FILE}.part${part}`,import.meta.url));
    if(!response.ok)throw Error('The local AI runtime could not be loaded. Prepare offline access while online, then try again.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  const bytes=new Uint8Array(parts.reduce((size,part)=>size+part.length,0));
  let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(bytes.length!==26861777||digest!=='49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082')throw Error('The AI runtime files are incomplete or damaged. Reinstall offline assets before enabling semantic search.');
  return bytes;
}
