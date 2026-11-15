import fs from 'node:fs/promises'
import path from 'node:path'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import math from '../quartz/node_modules/remark-math/index.js'
import remarkRehype from '../quartz/node_modules/remark-rehype/index.js'
import rehypeKatex from '../quartz/node_modules/rehype-katex/index.js'
import {toHtml} from '../quartz/node_modules/hast-util-to-html/index.js'
import {root,digest} from './inventory.mjs'

const dir=path.join(root,'.knowledge'),read=async p=>JSON.parse((await fs.readFile(path.join(dir,p),'utf8')).replace(/^\uFEFF/,''))
const index=await read('converted-v3-index.json'),state=await read('state.json')
const parser=remark().use(gfm).use(math)
const renderer=output=>remark().use(gfm).use(math).use(remarkRehype).use(rehypeKatex,{strict:'ignore',throwOnError:true,output})
const css=`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">\n<style>\n.math-note-region { color:var(--foreground); overflow-wrap:anywhere; }\n.math-note-region > :first-child { margin-top:0; }\n.math-note-region > :last-child { margin-bottom:0; }\n.math-note-region p,.math-note-region ul,.math-note-region ol,.math-note-region blockquote,.math-note-region table { margin:0 0 calc(var(--font-size-base) * 1); }\n.math-note-region .katex-display { max-width:100%; overflow-x:auto; overflow-y:hidden; }\n.math-note-region .katex { color:currentColor; }\n.math-note-region table { border-collapse:collapse; display:block; max-width:100%; overflow-x:auto; }\n.math-note-region th,.math-note-region td { padding:0.4em 0.6em; border-bottom:1px solid var(--border); text-align:left; }\n.math-note-region code { font-family:ui-monospace,Consolas,monospace; background:var(--muted); color:var(--foreground); }\n.math-note-region blockquote { border-left:2px solid var(--border); padding-left:1em; }\n</style>`
const pages=[],issues=[]
await fs.mkdir(path.join(dir,'formula-regions'),{recursive:true})
function hasMath(n){return n.type==='math'||n.type==='inlineMath'||(n.type==='code'&&n.lang==='math')||(n.children??[]).some(hasMath)}
function render(md,key){
 let source=md.replace(/```math\s*\n([\s\S]*?)\n```/g,(_,tex)=>'$$\n'+tex+'\n$$').replace(/^>\s*\[!CALLOUT\].*$/gm,'>')
 let proc=renderer('htmlAndMathml'),html=toHtml(proc.runSync(proc.parse(source)))
 if(Buffer.byteLength(css+html)>245000){proc=renderer('mathml');html=toHtml(proc.runSync(proc.parse(source)))}
 const result=css+'\n<div id="math-region-'+key+'" class="math-note-region" role="group" aria-label="含行内公式的笔记段落">\n'+html+'\n</div>\n'
 if(Buffer.byteLength(result)>256*1024)throw Error('Single mathematical block exceeds 256 KiB visualization budget')
 return result
}
for(const n of index){
 const body=await fs.readFile(path.join(dir,'converted-v3',n.file),'utf8'),tree=parser.parse(body),units=[]
 let run=[],bridge=[]
 async function flush(){
  if(!run.length)return
  const markdown=run.map(x=>body.slice(x.position.start.offset,x.position.end.offset)).join('\n\n')
  const key=digest(n.path+'\n'+markdown).slice(0,24)
  try{
   const html=render(markdown,key)
   await fs.writeFile(path.join(dir,'formula-regions',key+'.html'),html)
   await fs.writeFile(path.join(dir,'formula-regions',key+'.json'),JSON.stringify({key,source_path:n.path,markdown,source_sha256:digest(markdown),html_sha256:digest(html)},null,2))
   units.push({kind:'formula',key,markdown,html_file:'formula-regions/'+key+'.html',bytes:Buffer.byteLength(html),source_sha256:digest(markdown)})
  }catch(error){issues.push({path:n.path,key,error:error.message});units.push({kind:'native',markdown})}
  run=[]
 }
 function hasImage(node){return node.type==='image'||(node.children??[]).some(hasImage)}
 function appendNative(nodes){for(const node of nodes)units.push({kind:'native',markdown:body.slice(node.position.start.offset,node.position.end.offset)})}
 for(const node of tree.children){
  const mathematical=node.type!=='heading'&&hasMath(node)
  const hardBoundary=node.type==='heading'||node.type==='thematicBreak'||hasImage(node)||(node.type==='code'&&node.lang!=='math')
  if(mathematical){
   const span=run.length?node.position.end.offset-run[0].position.start.offset:0
   if(run.length&&(bridge.length>3||span>14000)){await flush();appendNative(bridge);bridge=[]}
   run.push(...bridge,node);bridge=[];continue
  }
  if(hardBoundary){await flush();appendNative(bridge);bridge=[];appendNative([node]);continue}
  if(run.length){bridge.push(node);continue}
  appendNative([node])
 }
 await flush();appendNative(bridge)
 if(units.some(u=>u.kind==='formula'))pages.push({path:n.path,title:n.title,page_id:state.pages[n.path].page_id,units,body_sha256:digest(body),regions:units.filter(u=>u.kind==='formula').length})
}
await fs.writeFile(path.join(dir,'formula-plan.json'),JSON.stringify({version:1,pages,issues},null,2))
console.log(JSON.stringify({pages:pages.length,regions:pages.reduce((a,p)=>a+p.regions,0),maxRegionBytes:Math.max(...pages.flatMap(p=>p.units.filter(u=>u.kind==='formula').map(u=>u.bytes))),issues},null,2))
