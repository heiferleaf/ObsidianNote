import fs from 'node:fs/promises'
import path from 'node:path'
import {root,walk,relative,digest} from './inventory.mjs'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import {wikiReferences} from './wiki-reference.mjs'
const inv=JSON.parse(await fs.readFile(path.join(root,'.knowledge/inventory.json'),'utf8'))
const allFiles=[...(await walk(path.join(root,'002-学习笔记'))),...(await walk(path.join(root,'003-Attachments'))),...(await walk(path.join(root,'009-电子书籍'))),...(await walk(path.join(root,'005-Excalidraw')))]
export function resolveTarget(raw,source) {
  let target
  try {target=decodeURIComponent(raw).replace(/\\/g,'/')}catch {target=raw}
  target=target.replace(/^<|>$/g,'').trim()
  const options=[path.resolve(root,path.dirname(source),target),path.resolve(root,target),path.resolve(root,path.dirname(source),target+'.md'),path.resolve(root,target+'.md')]
  for(const p of options) if(allFiles.includes(p)) return relative(p)
  const candidates=allFiles.filter(p=>relative(p).endsWith('/'+target)||path.basename(p)===target||path.basename(p,'.md')===target)
  if(candidates.length===1)return relative(candidates[0])
  if(candidates.length>1){
    candidates.sort((a,b)=>common(relative(b),source)-common(relative(a),source))
    if(common(relative(candidates[0]),source)>common(relative(candidates[1]),source))return relative(candidates[0])
  }
  return null
}
function common(a,b){let i=0;const x=a.split('/'),y=b.split('/');while(x[i]&&x[i]===y[i])i++;return i}
const assets=new Map(),unresolved=[],anchors=[]
for(const n of inv.notes) {
  const codeRanges=[]
  const walkNode=node=>{if(node.type==='code'||node.type==='inlineCode'){codeRanges.push({from:node.position.start.offset,to:node.position.end.offset});return};for(const c of node.children??[])walkNode(c)}
  walkNode(remark().use(gfm).parse(n.body))
  let clean=n.body
  for(const r of codeRanges.sort((a,b)=>b.from-a.from))clean=clean.slice(0,r.from)+clean.slice(r.from,r.to).replace(/[^\r\n]/g,' ')+clean.slice(r.to)
  const wikiRefs=wikiReferences(clean,codeRanges)
  const refs=[...wikiRefs.map(m=>({raw:m[2],embed:!!m[1],kind:'wiki'})),...Array.from(clean.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g),m=>({raw:m[2],embed:!!m[1],kind:'markdown'})),...Array.from(clean.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi),m=>({raw:m[1],embed:true,kind:'html'}))]
  for(const ref of refs) {
    const target=ref.raw.split('|')[0].trim(),[base,...fragments]=target.split('#'),fragment=fragments.join('#')
    if(/^https?:/.test(base)){if(ref.embed){const key=base;assets.set(key,{key,url:base,users:[...(assets.get(key)?.users??[]),n.path]})}continue}
    if(/^(data:|mailto:|tel:)/.test(base))continue
    const resolved=base?resolveTarget(base,n.path):n.path
    if(!resolved){unresolved.push({source:n.path,target:ref.raw});continue}
    if(resolved.endsWith('.md')&&!resolved.endsWith('.excalidraw.md')){if(fragment)anchors.push({source:n.path,target:resolved,fragment});continue}
    const isPdf=/\.pdf$/i.test(resolved)
    // PDF embeds keep the page content as a native image. Other PDF references keep page and selection context.
    const key=isPdf&&fragment?resolved+'#'+fragment:resolved
    assets.set(key,{key,path:resolved,fragment:fragment||null,pdf:isPdf,excalidraw:resolved.endsWith('.excalidraw.md'),embed:ref.embed,users:[...new Set([...(assets.get(key)?.users??[]),n.path])]})
  }
}
const plan={folders:inv.folders,notes:inv.notes.map(({body,...n})=>n),assets:[...assets.values()],anchors,unresolved}
await fs.writeFile(path.join(root,'.knowledge/plan.json'),JSON.stringify(plan,null,2))
if(process.argv[1]===path.join(import.meta.dirname,'prepare.mjs'))console.log(JSON.stringify({notes:plan.notes.length,folders:plan.folders.length,assets:plan.assets.length,pdfExcerpts:plan.assets.filter(a=>a.pdf).length,remoteImages:plan.assets.filter(a=>a.url).length,drawings:plan.assets.filter(a=>a.excalidraw).length,unresolved:plan.unresolved,anchors:anchors.length},null,2))
