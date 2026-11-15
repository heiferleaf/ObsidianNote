import fs from 'node:fs/promises'
import path from 'node:path'
import {root,digest,relative} from './inventory.mjs'
const read=async name=>JSON.parse((await fs.readFile(path.join(root,'.knowledge',name),'utf8')).replace(/^\uFEFF/,''))
const uploaded=await read('assets.json'),materialized=await read('materialized.json')
const attachments={},quartzAssets={},issues=[]
let backedUp=0
await fs.mkdir(path.join(root,'003-Attachments/pages-import'),{recursive:true})
for(const [key,r] of Object.entries(uploaded)){
 if(!r.file_access_confirmed||!r.reference){issues.push({key,reason:'not-confirmed'});continue}
 const m=materialized.find(x=>x.key===key)
 let source=m?.file
 if(!source){try{await fs.access(path.resolve(root,key));source=path.resolve(root,key)}catch{issues.push({key,reason:'source-file-not-found'});continue}}
 const bytes=await fs.readFile(source),sha256=digest(bytes)
 if(r.sha256&&r.sha256!==sha256){issues.push({key,reason:'uploaded-bytes-differ',local:sha256,remote:r.sha256});continue}
 let localPath=relative(source)
 if(localPath.startsWith('.knowledge/')||m?.url||m?.excalidraw||m?.pdf){
  const ext=path.extname(source).toLowerCase()||'.bin'
  localPath='003-Attachments/pages-import/'+sha256.slice(0,24)+ext
  const destination=path.join(root,localPath)
  try{await fs.access(destination)}catch{await fs.copyFile(source,destination);backedUp++}
 }
 attachments[r.reference]={path:localPath,sha256,source_key:key,mime_type:r.mime_type,byte_size:bytes.length}
 quartzAssets[key]={path:localPath,sha256,source_path:m?.path??null,fragment:m?.fragment??null,is_image:r.is_image}
}
await fs.writeFile(path.join(root,'.knowledge/attachments.json'),JSON.stringify(attachments,null,2))
await fs.writeFile(path.join(root,'.knowledge/quartz-assets.json'),JSON.stringify(quartzAssets,null,2))
await fs.writeFile(path.join(root,'.knowledge/asset-backup-issues.json'),JSON.stringify(issues,null,2))
console.log(JSON.stringify({uploadedKeys:Object.keys(uploaded).length,references:Object.keys(attachments).length,newBackups:backedUp,issues},null,2))
