import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadRuntimeBinary} from './dist/runtime-binary.mjs';
const originalFetch=globalThis.fetch;
const read=async url=>new Response(await readFile(url));
try{
  globalThis.fetch=read;
  const runtime=await loadRuntimeBinary();assert.equal(runtime.length,26861777);
  for(const part of [1,2])assert((await readFile(`dist/vendor/onnx/ort-wasm-simd-threaded.asyncify.wasm.part${part}`)).length<25*1024*1024);
  globalThis.fetch=async url=>{const bytes=new Uint8Array(await readFile(url));bytes[0]^=1;return new Response(bytes);};
  await assert.rejects(loadRuntimeBinary(),/incomplete or damaged/);
  globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(loadRuntimeBinary(),/could not be loaded/);
  console.log('Split runtime tests passed: exact binary hash, host file sizes, corrupt and missing parts.');
}finally{globalThis.fetch=originalFetch;}
