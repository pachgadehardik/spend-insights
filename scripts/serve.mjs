import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('dist');
const policy="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.hf.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.gz':'application/gzip','.svg':'image/svg+xml','.png':'image/png'};
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)||req.method!=='GET'){res.writeHead(403).end();return;}
 try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Security-Policy':policy,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404).end();}
}).listen(4174,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4174'));
