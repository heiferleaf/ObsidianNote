#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf8')) }

function toPosix(p){ return p.replace(/\\/g, path.sep) }

function parseFrontmatter(text){
  if(!text.startsWith('---')) return {fm:null,body:text}
  const idx = text.indexOf('\n---',3)
  if(idx===-1) return {fm:null,body:text}
  const fmText = text.slice(0, idx+4) // include closing --- and newline
  const body = text.slice(idx+5)
  return {fm:fmText, body}
}

function parseTagsFromFrontmatter(fm){
  if(!fm) return null
  const m = fm.match(/tags:\s*(\[.*?\]|[^\n\r]+)/s)
  if(!m) return null
  const raw = m[1].trim()
  if(raw.startsWith('[')){
    try{ return JSON.parse(raw.replace(/'/g,'"')) }catch(e){
      // fallback simple parse
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

function showDiff(orig, updated){
  const oLines = orig.split(/\r?\n/)
  const nLines = updated.split(/\r?\n/)
  const max = Math.max(oLines.length, nLines.length)
  const out = []
  for(let i=0;i<max;i++){
    const o = oLines[i] ?? ''
    const n = nLines[i] ?? ''
    if(o===n) out.push(' '+o)
    else{
      if(o) out.push('-'+o)
      if(n) out.push('+'+n)
    }
  }
  return out.join('\n')
}

async function main(){
  const argv = process.argv.slice(2)
  const sampleIdx = argv.indexOf('--sample')
  const apply = argv.includes('--apply')
  const n = sampleIdx!==-1 ? parseInt(argv[sampleIdx+1]||'5',10) : 5

  const reportPath = path.join(process.cwd(),'quartz','.tag-report.json')
  if(!fs.existsSync(reportPath)){
    console.error('report not found:', reportPath)
    process.exit(2)
  }
  const report = readJSON(reportPath)
  const items = report.items.filter(it=>Array.isArray(it.suggested) && it.suggested.length>0)
  const chosen = items.slice(0,n)
  if(chosen.length===0){ console.log('no suggestions found'); return }

  for(const it of chosen){
    const rel = it.file
    const filePath = path.join(process.cwd(), toPosix(rel))
    if(!fs.existsSync(filePath)){
      console.warn('file missing:', filePath)
      continue
    }
    const orig = fs.readFileSync(filePath,'utf8')
    const {fm, body} = parseFrontmatter(orig)
    const existingTags = parseTagsFromFrontmatter(fm) || []
    const merged = mergeTags(existingTags, it.suggested)

    let newFm = fm
    if(!newFm){
      // build a simple frontmatter with created/modified if absent? keep minimal
      newFm = '---\n' + buildTagsYaml(merged) + '---\n'
    }else{
      // replace or append tags block inside fm
      const fmBody = fm.replace(/(^---\n|\n---$)/g,'')
      let fmLines = fmBody.split(/\r?\n/).filter(Boolean)
      // remove existing tags lines
      fmLines = fmLines.filter(l=>!/^tags:\b/.test(l) && !/^\s*-\s*/.test(l) )
      // prepend new tags block
      const tagsYaml = buildTagsYaml(merged).trim() ? buildTagsYaml(merged) : ''
      const newFmBody = tagsYaml + (tagsYaml? '\n' : '') + fmLines.join('\n') + '\n'
      newFm = '---\n' + newFmBody + '---\n'
    }

    const updated = newFm + body

    console.log('=====', rel)
    console.log('Suggested:', JSON.stringify(it.suggested))
    console.log('Existing tags:', JSON.stringify(existingTags))
    console.log('Merged tags:', JSON.stringify(merged))
    console.log('--- diff ---')
    console.log(showDiff(orig.split('\n').slice(0,40).join('\n'), updated.split('\n').slice(0,40).join('\n')))

    if(apply){
      fs.writeFileSync(filePath, updated, 'utf8')
      console.log('[APPLIED] wrote', rel)
    }else{
      console.log('[DRY-RUN] not written')
    }
    console.log('\n')
  }
}

main().catch(err=>{ console.error(err); process.exit(1) })
