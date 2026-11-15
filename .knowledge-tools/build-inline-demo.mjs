import fs from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {root} from './inventory.mjs'
const require=createRequire(path.join(root,'quartz/package.json'))
const katex=require('katex')
let html=await fs.readFile(path.join(root,'.knowledge-tools/inline-format-demo.html'),'utf8')
html=html.replaceAll('katex@0.16.22','katex@'+require('katex/package.json').version)
html=html.replace(/<span data-math="([^"]+)"><\/span>/g,(_,tex)=>katex.renderToString(tex,{displayMode:false,throwOnError:true,output:'htmlAndMathml'}))
html=html.replace(/<script\b[\s\S]*?<\/script>/g,'')
await fs.writeFile(path.join(root,'.knowledge/inline-format-demo.html'),html)
console.log(JSON.stringify({bytes:Buffer.byteLength(html),formulas:(html.match(/class="katex"/g)??[]).length,hasInlineCode:html.includes('<code>threshold</code>')}))
