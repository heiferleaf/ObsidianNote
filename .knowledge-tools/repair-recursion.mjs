import fs from 'node:fs/promises'
import path from 'node:path'
import {root,digest} from './inventory.mjs'
import {renderMathRegion} from './render-math-region.mjs'
const dir=path.join(root,'.knowledge')
const plan=JSON.parse(await fs.readFile(path.join(dir,'formula-plan.json'),'utf8'))
const note=plan.pages.find(x=>x.path.endsWith('/递归程序.md'))
const old=note.units.find(u=>u.kind==='formula'&&u.markdown.includes('Alsuwaiyel'))
const markdown=old.markdown.replace(/\n- !\[\[[^\r\n]*?\]\]/,'')
if(markdown===old.markdown)throw Error('Original PDF source was not uniquely identified')
const key=digest(markdown).slice(0,24),html=renderMathRegion(markdown,key),html_file='formula-regions/'+key+'.html'
await fs.writeFile(path.join(dir,html_file),html)
await fs.writeFile(path.join(dir,'repair-recursion-region.json'),JSON.stringify({key,markdown,html_file,source_sha256:digest(markdown),html_sha256:digest(html),path:note.path,page_id:note.page_id},null,2))
console.log(JSON.stringify({key,bytes:Buffer.byteLength(html)}))
