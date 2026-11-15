import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {remark} from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import math from '../quartz/node_modules/remark-math/index.js'
import remarkRehype from '../quartz/node_modules/remark-rehype/index.js'
import rehypeKatex from '../quartz/node_modules/rehype-katex/index.js'
import {toHtml} from '../quartz/node_modules/hast-util-to-html/index.js'
import {root,digest} from './inventory.mjs'
const require=createRequire(path.join(root,'quartz/package.json'))
const katexVersion=require('katex/package.json').version
const css=`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${katexVersion}/dist/katex.min.css">\n<style>\n.math-note-region { color:var(--foreground); overflow-wrap:anywhere; }\n.math-note-region > :first-child { margin-top:0; }\n.math-note-region > :last-child { margin-bottom:0; }\n.math-note-region p,.math-note-region ul,.math-note-region ol,.math-note-region blockquote,.math-note-region table { margin:0 0 calc(var(--font-size-base) * 1); }\n.math-note-region .katex-display { max-width:100%; overflow-x:auto; overflow-y:hidden; }\n.math-note-region .katex { color:currentColor; }\n.math-note-region table { border-collapse:collapse; display:block; max-width:100%; overflow-x:auto; }\n.math-note-region th,.math-note-region td { padding:0.4em 0.6em; border-bottom:1px solid var(--border); text-align:left; }\n.math-note-region code { font-family:ui-monospace,Consolas,monospace; background:var(--muted); color:var(--foreground); }\n.math-note-region blockquote { border-left:2px solid var(--border); padding-left:1em; }\n</style>`
export function renderMathRegion(markdown,key=digest(markdown).slice(0,24)){
 const source=markdown.replace(/```math\s*\n([\s\S]*?)\n```/g,(_,tex)=>'$$\n'+tex+'\n$$').replace(/^>\s*\[!CALLOUT\].*$/gm,'>')
 const convert=output=>{const processor=remark().use(gfm).use(math).use(remarkRehype).use(rehypeKatex,{strict:'ignore',throwOnError:true,output});return toHtml(processor.runSync(processor.parse(source)))}
 let html=convert('htmlAndMathml')
 if(Buffer.byteLength(css+html)>245000)html=convert('mathml')
 // Ordinary links remain usable when the fragment is displayed inside a sandbox.
 html=html.replace(/<a\s+href="(https?:[^"<>]+)"/g,'<a target="_blank" rel="noopener noreferrer" href="$1"')
 const result=css+'\n<div id="math-region-'+key+'" class="math-note-region" role="group" aria-label="含行内公式的笔记段落">\n'+html+'\n</div>\n'
 if(Buffer.byteLength(result)>256*1024)throw Error('Single mathematical block exceeds 256 KiB visualization budget')
 return result
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),input=args[args.indexOf('--input')+1],output=args[args.indexOf('--output')+1]
 if(!args.includes('--input')||!args.includes('--output'))throw Error('Usage: render-math-region.mjs --input region.md --output region.html')
 const source=await fs.readFile(path.resolve(input),'utf8'),html=renderMathRegion(source)
 await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});await fs.writeFile(path.resolve(output),html)
 console.log(JSON.stringify({output:path.resolve(output),source_sha256:digest(source),html_sha256:digest(html),bytes:Buffer.byteLength(html)}))
}
