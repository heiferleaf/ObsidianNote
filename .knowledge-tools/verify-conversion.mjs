import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import {root} from './inventory.mjs'
import {normalizeCodeFences} from './fence-normalize.mjs'
import {normalizeMathMarkdown} from './math-normalize.mjs'
const dir=path.join(root,'.knowledge'),inv=JSON.parse(await fs.readFile(path.join(dir,'inventory.json'),'utf8'))
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'converted'
const index=JSON.parse(await fs.readFile(path.join(dir,out==='converted'?'converted-index.json':out+'-index.json'),'utf8'))
const parser=remark().use(gfm),problems=[]
let codeBlocks=0,renderableCodeBlocks=0,mathBlocks=0
for(const n of inv.notes){
 const converted=await fs.readFile(path.join(dir,out,index.find(x=>x.path===n.path).file),'utf8')
 if(/[\uE000\uE001]/.test(converted))problems.push({path:n.path,reason:'unexpanded-token'})
 const outTree=parser.parse(converted)
 const normalize=s=>s.replace(/\r\n/g,'\n').trim()
 const originalCode=[],convertedCode=[];const collect=(node,out)=>{if(node.type==='code')out.push(node);else for(const c of node.children??[])collect(c,out)};collect(parser.parse(n.body),originalCode);collect(outTree,convertedCode)
 const withoutWhitespace=s=>s.replace(/\s+/g,'')
 for(const c of originalCode){codeBlocks++;if(normalize(c.value)&&!withoutWhitespace(converted).includes(withoutWhitespace(c.value)))problems.push({path:n.path,reason:'source-code-content-missing',sample:c.value.slice(0,70)})}
 const repairedCode=[];collect(parser.parse(normalizeMathMarkdown(normalizeCodeFences(n.body))),repairedCode)
 for(const c of repairedCode){renderableCodeBlocks++;if(normalize(c.value)&&!convertedCode.some(o=>normalize(o.value)===normalize(c.value)))problems.push({path:n.path,reason:'renderable-code-block-changed',sample:c.value.slice(0,70)})}
 const count=node=>{if(node.type==='code'&&node.lang==='math')mathBlocks++;for(const c of node.children??[])count(c)};count(outTree)
 if(!converted.trim())problems.push({path:n.path,reason:'empty-output'})
}
const llm=index.find(x=>x.title==='LLM 到底是怎么一回事')
const llmBody=await fs.readFile(path.join(dir,out,llm.file),'utf8')
assert(llmBody.includes('通过前面生成的内容，决定下一步生成的内容。'))
assert(llmBody.includes('### 非自回归算法'))
const lambda=index.find(x=>x.title==='Course6 函数式编程'),lambdaBody=await fs.readFile(path.join(dir,out,lambda.file),'utf8')
assert(lambdaBody.includes('StreamClass$$Lambda$1'))
assert(lambdaBody.includes('StreamClass.lambda$test0$0'))
console.log(JSON.stringify({notes:index.length,preservedSourceCodeBlocks:codeBlocks,renderableCodeBlocks,nativeMathBlocks:mathBlocks,problems},null,2))
if(problems.length)process.exitCode=1
