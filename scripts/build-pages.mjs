import {readFile,writeFile,mkdir,readdir,rm,cp} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'docs');
const service='https://gold-packs-club.aromaticearth4.chatgpt.site';
const pages='https://kalebreus.github.io/cart-oteste';
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,'src'),{recursive:true});
await mkdir(resolve(output,'assets'),{recursive:true});
let html=await readFile(resolve(root,'index.html'),'utf8');
html=html.replaceAll(service,pages).replaceAll('src="/assets/','src="./assets/');
await writeFile(resolve(output,'index.html'),html);
for(const name of ['app.js','catalog.js','style.css'])await cp(resolve(root,'src',name),resolve(output,'src',name));
let count=0;
for(const name of await readdir(resolve(root,'assets'))){
  if(!/\.(?:png|jpe?g|webp)$/i.test(name))continue;
  await cp(resolve(root,'assets',name),resolve(output,'assets',name));
  count++;
}
await writeFile(resolve(output,'.nojekyll'),'');
await writeFile(resolve(output,'robots.txt'),`User-agent: *\nAllow: /cart-oteste/\nSitemap: ${pages}/sitemap.xml\n`);
await writeFile(resolve(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${pages}/</loc></url></urlset>\n`);
console.log(`GitHub Pages built in docs/: HTML, scripts, stylesheet and ${count} card images.`);
