import {readFile,writeFile,mkdir,readdir,rm,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await rm(resolve(root,'dist'),{recursive:true,force:true});await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});
const assets={};for(const [path,file,type] of [['/index.html','src/page.html','text/html; charset=utf-8'],['/style.css','src/style.css','text/css; charset=utf-8'],['/app.js','src/app.js','text/javascript; charset=utf-8']])assets[path]={type,data:(await readFile(resolve(root,file))).toString('base64')};
for(const name of await readdir(resolve(root,'assets'))){if(!name.endsWith('.png'))continue;assets['/assets/'+name]={type:'image/png',data:(await readFile(resolve(root,'assets',name))).toString('base64')}}
const examples=JSON.parse(await readFile(resolve(root,'assets/cards.json'),'utf8')).map((card,i)=>({...card,rarity:i===5?'Rara':i===3?'Ultra rara':'Secreta',condition:'Não avaliada',author:'Gold Packs · Exemplo',createdAt:'2026-01-01T00:00:00Z',isOwner:false}));
const server=await readFile(resolve(root,'src/server.js'),'utf8');
await writeFile(resolve(root,'dist/server/index.js'),server+'\nconst assets='+JSON.stringify(assets)+';\nconst examples='+JSON.stringify(examples)+';\nexport default {fetch:createHandler(assets,examples)};\n');
await cp(resolve(root,'.openai/hosting.json'),resolve(root,'dist/.openai/hosting.json'));
await cp(resolve(root,'drizzle'),resolve(root,'dist/drizzle'),{recursive:true});
const manifest=JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8'));
await writeFile(resolve(root,'dist/server/wrangler.json'),JSON.stringify({name:'gold-packs',main:'index.js',compatibility_date:'2026-01-01',d1_databases:[{binding:'DB',database_name:'gold-packs',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:'../drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:'gold-packs'}]}));
if(!manifest.project_id)throw new Error('Missing Site identity');
console.log('Gold Packs built: Worker, assets and schema migrations.');
