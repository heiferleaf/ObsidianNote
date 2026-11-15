import fs from 'node:fs/promises'
import path from 'node:path'
import {root} from './inventory.mjs'
const dir=path.join(root,'.knowledge')
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'converted'
const index=JSON.parse(await fs.readFile(path.join(dir,out==='converted'?'converted-index.json':out+'-index.json'),'utf8'))
if(process.argv[2]==='list')console.log(JSON.stringify(index.map((n,i)=>({index:i,path:n.path,title:n.title,target:n.target,hasAssets:n.hasAssets}))))
if(process.argv[2]==='note'){
 const n=index[Number(process.argv[3])]
 console.log(JSON.stringify({...n,body:await fs.readFile(path.join(dir,out,n.file),'utf8')}))
}
