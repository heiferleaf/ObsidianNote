import fs from 'node:fs/promises'
import path from 'node:path'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import {root,digest} from './inventory.mjs'
import {resolveTarget} from './prepare.mjs'
import {normalizeMath,normalizeMathMarkdown} from './math-normalize.mjs'
import {normalizeCodeFences} from './fence-normalize.mjs'
import {isNumericMatrixWiki,wikiReferences} from './wiki-reference.mjs'

const read=async name=>JSON.parse(await fs.readFile(path.join(root,'.knowledge',name),'utf8').then(t=>t.replace(/^\uFEFF/,'')))
const inv=await read('inventory.json'),plan=await read('plan.json'),state=await read('state.json')
let uploaded={};try{uploaded=await read('assets.json')}catch{}
const assets={...state.assets,...uploaded}
const parser=remark().use(gfm)
const missing=[]
const outputName=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'converted'
const indexName=outputName==='converted'?'converted-index.json':outputName+'-index.json'
const gapName=outputName==='converted'?'conversion-gaps.json':outputName+'-gaps.json'
const preserveInlineMath=process.argv.includes('--inline-embeds')
const mdLabel=s=>s.replace(/\[/g,'\\[').replace(/\]/g,'\\]')
const plain=s=>s.replace(/[*_`]/g,'').replace(/\s+/g,' ').trim()
const wikiCache=new Map()
function noteWikiReferences(note){
  if(!wikiCache.has(note.path)){
    const ranges=[]
    const visit=node=>{if(node.type==='code'||node.type==='inlineCode'){ranges.push({from:node.position.start.offset,to:node.position.end.offset});return};for(const child of node.children??[])visit(child)}
    visit(parser.parse(note.body));wikiCache.set(note.path,wikiReferences(note.body,ranges))
  }
  return wikiCache.get(note.path)
}
function findNote(target,source){
  const resolved=target?resolveTarget(target,source):source
  // The old Redis link names a topic which has no exact file. Its server overview is the closest maintained entry.
  if(!resolved&&target==='Redis')return inv.notes.find(n=>n.title==='Redis服务器')?.path
  return resolved
}
function destination(raw,source,embed=false,label='') {
  const [targetWithFragment,alias]=raw.split('|'),[base,...tail]=targetWithFragment.trim().split('#'),fragment=tail.join('#')
  const resolved=/^https?:/i.test(base)?base:findNote(base,source)
  const title=alias?.trim()||label||base||fragment
  if(resolved&&state.pages[resolved]) {
    const page=state.pages[resolved],anchor=state.anchors?.[resolved]?.[fragment]
    const url=anchor?.url||page.url
    const section=fragment&&!anchor?`（参见${fragment.startsWith('^')?'对应段落':'章节「'+plain(fragment)+'」'}）`:''
    return `[${mdLabel(title||page.title)}](${url})${section}`
  }
  const key=resolved?(fragment&&/\.pdf$/i.test(resolved)?resolved+'#'+fragment:resolved):raw
  const asset=assets[key]
  if(asset?.file_access_confirmed&&asset.reference){
    if(asset.is_image&&embed)return `\n\n![${mdLabel(title||path.basename(resolved||key))}](${asset.reference})\n\n`
    return `[${mdLabel(title||asset.file_name)}](${asset.reference})`
  }
  if(/^https?:/i.test(base)) {
    if(embed)missing.push({source,key,reason:'remote-image-not-uploaded'})
    return `[${mdLabel(title||base)}](${base})`
  }
  if(resolved||embed){missing.push({source,key,reason:'attachment-not-uploaded'})}
  else missing.push({source,key:raw,reason:'target-not-found'})
  return `**${mdLabel(title||raw)}**（${embed?'原附件':'原链接'}：\`${targetWithFragment}\`）`
}
function convert(n) {
  const tokens=[],replacements=[],equations=[]
  function token(value){const key=`\uE000${tokens.length}\uE001`;tokens.push(value);return key}
  let source=normalizeMathMarkdown(normalizeCodeFences(n.body)).replace(/\r\n/g,'\n')
  // Obsidian accepts display delimiters touching prose. Normalize pairs before parsing,
  // after shielding code so an unmatched closing delimiter cannot swallow the rest of a note.
  const codeRanges=[]
  function completeCode(raw){
    const lines=raw.trimEnd().split('\n'),opening=lines[0].match(/^(`{3,}|~{3,})/)
    if(!opening)return raw
    const fence=opening[1],last=lines.at(-1).trim().replace(/^(?:>[\t ]*)+/,'').trim()
    if(lines.length===1||last[0]!==fence[0]||!new RegExp('^'+fence[0]+'{'+fence.length+',}$').test(last))return raw+'\n'+fence+'\n'
    return raw
  }
  function shield(node){
    if(node.type==='code'||node.type==='inlineCode'){codeRanges.push({from:node.position.start.offset,to:node.position.end.offset,kind:node.type});return}
    for(const c of node.children??[])shield(c)
  }
  shield(parser.parse(source))
  for(const r of codeRanges.sort((a,b)=>b.from-a.from)){const raw=source.slice(r.from,r.to);source=source.slice(0,r.from)+token(r.kind==='code'?completeCode(raw):raw)+source.slice(r.to)}
  source=source.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g,(_,value)=>'\n\n'+token('```math\n'+normalizeMath(value.trim().replace(/^>\s?/gm,''))+'\n```')+'\n\n')
  source=source.replace(/(?<!\\)\$(?!\$)([^\n$]+?)(?<!\\)\$(?!\$)/g,(_,value)=>{
    if(preserveInlineMath)return token('$'+normalizeMath(value)+'$')
    value=normalizeMath(value);let i=equations.indexOf(value);if(i<0){i=equations.length;equations.push(value)}
    return token('`'+value.replace(/`/g,'′')+'`〔'+(i+1)+'〕')
  })
  const tree=parser.parse(source)
  function visit(node,ancestors=[]){
    const from=node.position?.start.offset,to=node.position?.end.offset
    if(node.type==='code'||node.type==='inlineCode') {
      replacements.push({from,to,value:token(source.slice(from,to))});return
    }
    if(node.type==='image'||node.type==='link'){
      if(node.type==='link'&&/^(?:https?:|mailto:|tel:)/i.test(node.url))return
      if(node.type==='link'&&/^[a-z][a-z0-9+.-]*:/i.test(node.url)&&source.slice(from,to).startsWith('<')){replacements.push({from,to,value:token('`'+source.slice(from,to)+'`')});return}
      const label=node.alt??node.children?.map(c=>c.value??'').join('')??''
      replacements.push({from,to,value:token(destination(node.url,n.path,node.type==='image',label))});return
    }
    if(node.type==='html'){
      const raw=node.value
      const image=raw.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i)
      let converted=image?destination(image[1],n.path,true):raw.replace(/<br\s*\/?>/gi,'\n').replace(/<(?:strong|b)\b[^>]*>/gi,'**').replace(/<\/(?:strong|b)>/gi,'**').replace(/<(?:em|i)\b[^>]*>/gi,'*').replace(/<\/(?:em|i)>/gi,'*').replace(/<\/?(?:span|div|font|center|p|u|mark|details|summary)\b[^>]*>/gi,'')
      replacements.push({from,to,value:token(converted)});return
    }
    for(const child of node.children??[])visit(child,[...ancestors,node])
  }
  visit(tree)
  let body=source
  for(const r of replacements.sort((a,b)=>b.from-a.from))body=body.slice(0,r.from)+r.value+body.slice(r.to)
  body=body.replace(/(!?)\[\[([^\r\n\uE000\uE001]+?)\]\]/g,(full,bang,raw)=>!bang&&isNumericMatrixWiki(full)?full:destination(raw,n.path,!!bang))
    .replace(/%%[\s\S]*?%%/g,'')
    .replace(/==([^=\n]+)==/g,'**$1**')
    .replace(/^\s*\^[-\w]+\s*$/gm,'')
    .replace(/[ \t]+\^[-\w]+\s*$/gm,'')
    .replace(/^(>\s*)\[![^\]]+\][+-]?\s*(.*)$/gm,(_,q,title)=>`${q}[!CALLOUT]\n${q}\n${title?q+'**'+title.trim()+'**\n'+q:''}`)
    .replace(/^\s*\[TOC\]\s*$/gmi,'')
    .replace(/\[\^([^\]]+)\]:\s*(.+)/g,'注 $1：$2').replace(/\[\^([^\]]+)\]/g,'〔注 $1〕')
  for(let pass=0;pass<5&&/\uE000\d+\uE001/.test(body);pass++)body=body.replace(/\uE000(\d+)\uE001/g,(_,i)=>tokens[Number(i)])
  const first=body.match(/^\s*#\s+(.+)\n/)
  if(first&&plain(first[1])===plain(n.title))body=body.slice(first[0].length)
  if(equations.length)body+='\n\n# 行内公式\n\n'+equations.map((v,i)=>`公式 ${i+1}\n\n\`\`\`math\n${v}\n\`\`\``).join('\n\n')
  const backlinks=inv.notes.filter(other=>other.path!==n.path&&(plan.anchors.some(a=>a.source===other.path&&a.target===n.path)||new RegExp('\\[\\[(?:'+n.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?:[|#\\]])').test(noteWikiReferences(other).map(m=>m[0]).join('\n')))).map(other=>state.pages[other.path]).filter(Boolean)
  if(backlinks.length)body+='\n\n# 引用本篇的笔记\n\n'+[...new Map(backlinks.map(p=>[p.page_id,p])).values()].map(p=>`- [${mdLabel(p.title)}](${p.url})`).join('\n')
  return body.trim()||'本篇笔记尚未填写正文。'
}
await fs.mkdir(path.join(root,'.knowledge',outputName),{recursive:true})
const targets=new Set(plan.anchors.map(a=>a.target))
for(const n of inv.notes){
 const tree=parser.parse(n.body)
 const visit=node=>{if(node.type==='code'||node.type==='inlineCode')return;if(node.type==='link'&&!/^[a-z]+:/i.test(node.url)){const resolved=findNote(node.url.split('#')[0],n.path);if(resolved&&inv.notes.some(x=>x.path===resolved))targets.add(resolved)};for(const c of node.children??[])visit(c)}
 visit(tree)
 for(const m of noteWikiReferences(n)){
  const base=m[2].split('|')[0].split('#')[0].trim(),resolved=findNote(base,n.path)
  if(resolved&&inv.notes.some(x=>x.path===resolved))targets.add(resolved)
 }
}
const index=[]
for(const n of inv.notes){
 const body=convert(n),filename=digest(n.path).slice(0,20)+'.md'
 await fs.writeFile(path.join(root,'.knowledge',outputName,filename),body)
 index.push({path:n.path,title:n.title,file:filename,bytes:Buffer.byteLength(body),source_sha256:n.sha256,target:targets.has(n.path),hasAssets:plan.assets.some(a=>a.users.includes(n.path)),source_frontmatter:n.data})
}
await fs.writeFile(path.join(root,'.knowledge',indexName),JSON.stringify(index,null,2))
await fs.writeFile(path.join(root,'.knowledge',gapName),JSON.stringify(missing,null,2))
if(process.argv.includes('--summary'))console.log(JSON.stringify({notes:index.length,linkTargets:targets.size,assetNotes:index.filter(n=>n.hasAssets).length,gaps:missing.length,largest:Math.max(...index.map(n=>n.bytes))}))
if(process.argv.includes('--note')){
 const idx=Number(process.argv[process.argv.indexOf('--note')+1]),n=index[idx]
 console.log(JSON.stringify({...n,body:await fs.readFile(path.join(root,'.knowledge',outputName,n.file),'utf8')}))
}
