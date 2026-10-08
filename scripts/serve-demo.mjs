import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/demonstracao.html':url.pathname));const rel=relative(root,file);if(rel==='..'||rel.startsWith('..'+sep))throw new Error('Caminho inválido');res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Não encontrado');}}).listen(4173,'127.0.0.1',()=>console.log('Demonstração: http://127.0.0.1:4173/demonstracao.html'));
