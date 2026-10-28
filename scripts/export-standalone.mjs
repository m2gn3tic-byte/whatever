#!/usr/bin/env node
/** Export the production game as one directly openable, offline HTML file. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, 'artifacts', 'Mahub-kull.html');
const mimeTypes = {'.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif',
  '.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf'};
const encoded = new Map();
function localFile(url, baseFile = resolve(dist,'index.html')) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) throw new Error(`Cannot embed external resource: ${url}`);
  const pathname = decodeURIComponent(url.split(/[?#]/,1)[0]);
  const file = pathname.startsWith('/') ? resolve(dist,`.${pathname}`) : resolve(dirname(baseFile),pathname);
  const within = relative(dist,file);
  if (!within || within === '..' || within.startsWith(`..${sep}`)) throw new Error(`Resource must be inside dist/: ${url}`);
  return file;
}
async function dataUri(url,baseFile) {
  if (/^(?:data:|#)/i.test(url)) return url;
  const file = localFile(url,baseFile);
  if (!encoded.has(file)) {
    const mime = mimeTypes[extname(file).toLowerCase()];
    if (!mime) throw new Error(`Unsupported standalone asset: ${relative(root,file)}`);
    encoded.set(file,`data:${mime};base64,${(await readFile(file)).toString('base64')}`);
  }
  return encoded.get(file);
}
async function inlineCss(css,file) {
  const urls = /url\(\s*(?:(["'])(.*?)\1|([^'"\s][^)]*?))\s*\)/gs;
  let result = '',previous = 0;
  for (const match of css.matchAll(urls)) {
    const value = (match[2] ?? match[3]).trim();
    result += css.slice(previous,match.index);
    result += /^(?:data:|#)/i.test(value) ? match[0] : `url("${await dataUri(value,file)}")`;
    previous = match.index + match[0].length;
  }
  result += css.slice(previous);
  if (/@import\b/i.test(result)) throw new Error('Bundle CSS imports before standalone export.');
  return result.replace(/<\/style/gi,'\\3C /style');
}
const attribute = (tag,name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`,'is'))?.[2];
const scriptSafe = text => text.replace(/<\/script/gi,'<\\/script');
let html;
try { html = await readFile(resolve(dist,'index.html'),'utf8'); }
catch(error) { throw new Error('Run npm run build first; dist/index.html is required.',{cause:error}); }
html = html.replace(/<html\b([^>]*)>/i,'<html$1 data-standalone>');
html = html.replace(/<link\b[^>]*>/gi,tag => ['manifest','modulepreload','preload','prefetch'].includes(attribute(tag,'rel')) ? '' : tag);
for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
  const tag = match[0], rel = attribute(tag,'rel'), href = attribute(tag,'href');
  if (!href) continue;
  if (rel === 'stylesheet') {
    const file = localFile(href);
    const style = await inlineCss(await readFile(file,'utf8'),file);
    html = html.replace(tag,() => `<style>${style}</style>`);
  } else if (rel === 'icon') {
    const uri = await dataUri(href);
    html = html.replace(tag,() => tag.replace(href,() => uri));
  } else throw new Error(`Unsupported HTML link: ${tag}`);
}
const modules = [...html.matchAll(/<script\b([^>]*)>\s*<\/script\s*>/gi)];
if (!modules.length) throw new Error('No production JavaScript entry found.');
for (const match of modules) {
  const src = attribute(match[1],'src');
  if (!src) continue;
  const js = await readFile(localFile(src),'utf8');
  if (/\bimport\s*\(/.test(js) || /\bfrom\s*["'][./]/.test(js)) throw new Error('Standalone export needs one bundled entry without imported chunks.');
  if (!js.includes('data-standalone') || !js.includes('__MAHUB_ASSETS__')) throw new Error('Rebuild current code: standalone guards are required.');
  html = html.replace(match[0],() => `<script type="module">${scriptSafe(js)}</script>`);
}
const assets = {items:await dataUri('/assets/items.png')};
html = html.replace(/<script type="module">/i,tag => `<script>window.__MAHUB_ASSETS__=${scriptSafe(JSON.stringify(assets))};</script>\n${tag}`);
if (/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']\//i.test(html)) throw new Error('Unresolved application resource remains.');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html,'utf8');
console.log(`Standalone game: ${relative(root,output)} (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB)`);
