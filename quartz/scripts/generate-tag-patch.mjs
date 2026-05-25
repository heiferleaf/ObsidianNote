#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf8')) }
function toFs(p){ return p.replace(/\\/g, path.sep) }

function parseFrontmatter(text){
  if(!text.startsWith('---')) return {fm:null,body:text}
  const idx = text.indexOf('\n---',3)
  if(idx===-1) return {fm:null,body:text}
  const fmText = text.slice(0, idx+4)
  const body = text.slice(idx+5)
  return {fm:fmText, body}
}

function parseTagsFromFrontmatter(fm){
  if(!fm) return []
  const m = fm.match(/tags:\s*(\[.*?\]|[^\n\r]+)/s)
  if(!m) return []
  const raw = m[1].trim()
  if(raw.startsWith('[')){
    try{ return JSON.parse(raw.replace(/'/g,'"')) }catch(e){
      return raw.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,''))
    }
  }
  return raw.split(/[,\s]+/).filter(Boolean)
}

function buildTagsYaml(tags){
  if(!tags || tags.length===0) return ''
  const q = tags.map(t=>`  - ${t}`).join('\n')
  return `tags:\n${q}\n`
}

function mergeTags(existing, suggested){
  const set = new Set((existing||[]).map(s=>s.trim()).filter(Boolean))
  suggested.forEach(s=>set.add(s.trim()))
  return Array.from(set)
}

function unifiedDiff(aLines, bLines, aPath, bPath){
  const header = `--- a/${aPath}\n+++ b/${bPath}\n`
  const out = [header]
  const max = Math.max(aLines.length, bLines.length)
  for(let i=0;i<max;i++){
    const a = aLines[i] ?? ''
    const b = bLines[i] ?? ''
    if(a===b) out.push(' '+a)
    else{
      if(a) out.push('-'+a)
      if(b) out.push('+'+b)
    }
  }
  return out.join('\n') + '\n\n'
}

async function main(){
  const cwd = process.cwd()
  const reportPath = path.join(cwd,'quartz','.tag-report.json')
  if(!fs.existsSync(reportPath)){
    console.error('report not found at', reportPath)
    process.exit(2)
  }
  const report = readJSON(reportPath)
  const items = report.items.filter(it=>Array.isArray(it.suggested) && it.suggested.length>0)
  if(items.length===0){ console.log('no suggested items'); return }

  const patches = []
  for(const it of items){
    const rel = it.file
    const filePath = path.join(cwd, toFs(rel))
    if(!fs.existsSync(filePath)){
      console.warn('skip missing file', filePath)
      continue
    }
    const orig = fs.readFileSync(filePath,'utf8')
    const {fm, body} = parseFrontmatter(orig)
    const existing = parseTagsFromFrontmatter(fm)
    const merged = mergeTags(existing, it.suggested)

    let newFm = fm
    if(!newFm){
      newFm = '---\n' + buildTagsYaml(merged) + '---\n'
    }else{
      const fmBody = fm.replace(/(^---\n|\n---$)/g,'')
      let fmLines = fmBody.split(/\r?\n/).filter(Boolean)
      fmLines = fmLines.filter(l=>!/^tags:\b/.test(l) && !/^\s*-\s*/.test(l) )
      const tagsYaml = buildTagsYaml(merged).trim() ? buildTagsYaml(merged) : ''
      const newFmBody = tagsYaml + (tagsYaml? '\n' : '') + fmLines.join('\n') + '\n'
      newFm = '---\n' + newFmBody + '---\n'
    }

    const updated = newFm + body
    const aLines = orig.split(/\r?\n/)
    const bLines = updated.split(/\r?\n/)
    patches.push(unifiedDiff(aLines,bLines, rel, rel))
  }

  const outPath = path.join(cwd,'quartz','.tag-apply.patch')
  fs.writeFileSync(outPath, patches.join(''), 'utf8')
  console.log('wrote patch to', outPath)
}

main().catch(e=>{ console.error(e); process.exit(1) })
