import fs from 'node:fs/promises'
import path from 'node:path'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import {root,digest} from './inventory.mjs'
const dir=path.join(root,'.knowledge'),read=async name=>JSON.parse((await fs.readFile(path.join(dir,name),'utf8')).replace(/^\uFEFF/,''))
const out=process.argv.includes('--expected')?process.argv[process.argv.indexOf('--expected')+1]:'converted'
if(out==='converted-v3'){
 const {buildCandidate}=await import('./finalize-knowledge.mjs')
 const candidate=await buildCandidate(root,true)
 const verified=Object.values(candidate.manifest.pages).filter(p=>p.kind==='note'&&p.migration_status==='verified').map(p=>({path:p.path,page_id:p.page_id,comparison:p.verification_comparison}))
 await fs.writeFile(path.join(dir,'page-verification.json'),JSON.stringify({verified,issues:candidate.report.issues,summary:candidate.report},null,2)+'\n')
 console.log(JSON.stringify(candidate.report,null,2))
 if(candidate.report.issues.length)process.exitCode=1
}else{
const state=await read('state.json'),index=await read(out==='converted'?'converted-index.json':out+'-index.json'),parser=remark().use(gfm)
const issues=[],verified=[]
const compact=s=>s.replace(/\r\n/g,'\n').replace(/\s+/g,' ').trim()
function signature(markdown){
 const result={text:[],code:[],images:[],links:[],headings:[],tasks:[]}
 function visit(n){
  if(n.type==='code'){result.code.push({lang:n.lang??null,value:n.value.replace(/\r\n/g,'\n').trim()});return}
  if(n.type==='text'||n.type==='inlineCode')result.text.push(compact(n.value))
  if(n.type==='image')result.images.push({url:n.url,alt:n.alt??''})
  if(n.type==='link')result.links.push(n.url)
  if(n.type==='heading')result.headings.push(n.depth)
  if(n.type==='listItem'&&typeof n.checked==='boolean')result.tasks.push(n.checked)
  for(const c of n.children??[])visit(c)
 }
 visit(parser.parse(markdown))
 result.text=compact(result.text.join(' '))
 return result
}
for(const n of index){
 const row=state.pages[n.path]
 if(!row?.populated)continue
 let p;try{p=await read('exports/'+row.page_id+'.json')}catch{issues.push({path:n.path,reason:'snapshot-missing'});continue}
 p=p.structuredContent??p
 if(!p.content?.blocks){issues.push({path:n.path,reason:'invalid-snapshot'});continue}
 if(p.metadata?.parent?.page_id!==row.parent_page_id)issues.push({path:n.path,reason:'parent-mismatch'})
 const actual=p.content.blocks.filter(b=>b.kind==='markdown').map(b=>b.markdown).join('\n\n')
 const expected=await fs.readFile(path.join(dir,out,n.file),'utf8'),a=signature(actual),e=signature(expected)
 const differences=Object.keys(e).filter(key=>JSON.stringify(a[key])!==JSON.stringify(e[key]))
 if(differences.length)issues.push({path:n.path,page_id:row.page_id,reason:'semantic-difference',differences,expectedSignature:digest(JSON.stringify(e)),actualSignature:digest(JSON.stringify(a))})
 else verified.push({path:n.path,page_id:row.page_id,blocks:p.content.blocks.length,images:a.images.length,codeBlocks:a.code.length})
}
await fs.writeFile(path.join(dir,'page-verification.json'),JSON.stringify({verified,issues},null,2))
console.log(JSON.stringify({verified:verified.length,issues},null,2))
if(issues.length)process.exitCode=1
}
