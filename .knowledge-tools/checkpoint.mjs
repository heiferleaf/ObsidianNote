import fs from 'node:fs/promises'
import path from 'node:path'
import {root} from './inventory.mjs'
const p=path.join(root,'.knowledge/state.json')
const state=JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''))
for(const journal of ['pages.jsonl','pages-curator.jsonl']){
 try{
  for(const line of (await fs.readFile(path.join(root,'.knowledge',journal),'utf8')).split(/\r?\n/).filter(x=>x.trim())){
   const {key,page}=JSON.parse(line.replace(/^\uFEFF/,''));state.pages[key]=page
  }
 }catch(e){if(e.code!=='ENOENT')throw e}
}
await fs.writeFile(p,JSON.stringify(state,null,2))
console.log(JSON.stringify({pages:Object.keys(state.pages).length}))
