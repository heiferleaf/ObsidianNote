import fs from 'node:fs/promises'
import path from 'node:path'
import {root} from './inventory.mjs'
const [worker,mode,selector]=process.argv.slice(2)
if(!/^bulk[1-4]$/.test(worker))throw Error('Expected bulk1 through bulk4')
const dir=path.join(root,'.knowledge'),q=JSON.parse(await fs.readFile(path.join(dir,'formula-queue-'+worker+'.json'),'utf8'))
if(mode==='list')console.log(JSON.stringify(q.pages.map((p,index)=>({index,path:p.path,page_id:p.page_id,regions:p.regions}))))
else if(mode==='page')console.log(JSON.stringify(q.pages[Number(selector)]))
else if(mode==='html'){
 if(!/^[a-f0-9]{24}$/.test(selector))throw Error('Invalid region key')
 console.log(JSON.stringify({html:await fs.readFile(path.join(dir,'formula-regions',selector+'.html'),'utf8')}))
}else if(mode==='receipts'){
 const rows=[]
 for(const file of (await fs.readdir(dir)).filter(f=>/^formula-receipts-.*\.jsonl$/.test(f))){
  for(const line of (await fs.readFile(path.join(dir,file),'utf8')).split(/\r?\n/).filter(l=>l.trim())){
   try{rows.push(JSON.parse(line.replace(/^\uFEFF/,'')))}catch{}
  }
 }
 console.log(JSON.stringify(rows))
}else throw Error('Expected list, page, html, or receipts')
