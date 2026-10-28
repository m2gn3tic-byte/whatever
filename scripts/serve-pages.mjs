/** Strict local test server: assets outside the actual Pages path return 404. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist-pages');
const prefix = '/whatever/';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if (!url.pathname.startsWith(prefix) || req.method !== 'GET') {res.writeHead(404);res.end();return;}
    const name = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = resolve(root,name);
    if (!file.startsWith(root+sep)) {res.writeHead(404);res.end();return;}
    const bytes = await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Vary':'Origin'});
    res.end(bytes);
  } catch {res.writeHead(404);res.end();}
}).listen(4273,'0.0.0.0',() => console.log('Pages path test server ready on port 4273'));
