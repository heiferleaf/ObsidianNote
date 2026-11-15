import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import matter from '../quartz/node_modules/gray-matter/index.js'

export const root = path.resolve(import.meta.dirname, '..')
export async function walk(dir) {
  const out = []
  for (const e of await fs.readdir(dir, {withFileTypes:true})) {
    const p = path.join(dir,e.name)
    if(e.isDirectory()) out.push(...await walk(p)); else out.push(p)
  }
  return out
}
export const relative = p => path.relative(root,p).split(path.sep).join('/')
export const digest = s => crypto.createHash('sha256').update(s).digest('hex')
export async function inventory() {
  const files = await walk(path.join(root,'002-学习笔记'))
  const notes = []
  for(const p of files.filter(p=>p.endsWith('.md'))) {
    const raw = await fs.readFile(p,'utf8')
    let parsed
    try {parsed=matter(raw)} catch(error) {throw new Error(`${relative(p)}: ${error.message}`)}
    notes.push({path:relative(p),title:path.basename(p,'.md'),data:parsed.data,body:parsed.content,sha256:digest(raw),bytes:Buffer.byteLength(raw)})
  }
  const folders=[...new Set(notes.flatMap(n=>{
    const parts=n.path.split('/').slice(0,-1);return parts.map((_,i)=>parts.slice(0,i+1).join('/'))
  }))].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b,'zh-CN'))
  return {notes,folders,assets:(await walk(path.join(root,'003-Attachments'))).map(p=>({path:relative(p),absolute:p})),otherFiles:files.filter(p=>!p.endsWith('.md')).map(relative)}
}
if(process.argv[1]===path.join(import.meta.dirname,'inventory.mjs')) {
  const inv=await inventory()
  await fs.mkdir(path.join(root,'.knowledge'),{recursive:true})
  await fs.writeFile(path.join(root,'.knowledge/inventory.json'),JSON.stringify(inv,null,2))
  console.log(JSON.stringify({notes:inv.notes.length,folders:inv.folders.length,assets:inv.assets.length,bytes:inv.notes.reduce((a,n)=>a+n.bytes,0),largest:inv.notes.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,5).map(n=>({path:n.path,bytes:n.bytes})),otherFiles:inv.otherFiles},null,2))
}
