import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
const root=path.resolve('dist/lookup/browser');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const relative=decodeURIComponent(url.pathname);let file=path.resolve(root,'.'+relative);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{if(path.extname(file)){res.writeHead(404).end('Archivo no encontrado');return;}file=path.join(root,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(500).end('Ejecute npm run build antes de npm run preview.');}});
server.listen(4200,'127.0.0.1',()=>console.log('Lookup: http://127.0.0.1:4200/ (producción local)'));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'El puerto 4200 está ocupado. Detenga npm start u otra instancia de Lookup.':e);process.exitCode=1;});
