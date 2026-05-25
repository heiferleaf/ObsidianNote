#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const contentRoot = path.resolve(process.cwd(), 'content')

async function walkMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...(await walkMarkdownFiles(full)))
    else if (e.isFile() && e.name.endsWith('.md')) files.push(full)
  }
  return files
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[\u4e00-\u9fff\s\/\\]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function stripNumericPrefix(name) {
  // remove leading numeric prefixes like '002-' or '01_'
  return name.replace(/^\d+[\-_.\s]*/,'')
}

function extractFrontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end + 1) // include trailing newline
  return { raw: block, start: 0, end: end + 4 }
}

function hasTags(front) {
  return /(^|\n)tags\s*:/m.test(front)
}

function getTitleFromFront(front) {
  const m = front.match(/(^|\n)title\s*:\s*(.+)/m)
  if (m) return m[2].trim().replace(/^"|"$/g, '')
  return null
}

function getFirstH1(content) {
  const m = content.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}

function suggestTags(filePath, content, frontRaw) {
  const rel = path.relative(contentRoot, filePath)
  const parts = rel.split(/[\\\/]/).filter(Boolean)
  const candidates = new Set()
  // use folder names (normalize and strip numeric prefixes)
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    const raw = parts[i].replace(/\.[^/.]+$/, '')
    const stripped = stripNumericPrefix(raw)
    candidates.add(stripped)
  }

  const title = getTitleFromFront(frontRaw) || getFirstH1(content) || path.basename(filePath, '.md')
  // pick meaningful words from title
  const words = (title || '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 4)
  for (const w of words) candidates.add(w)

  // normalize
  const tags = [...candidates].map(t => slugify(t)).filter(Boolean)
  // filter meaningless tags
  const blacklist = new Set(['002','000','001'])
  const mapped = tags.map(t => {
    // mapping common chinese folder names to english tags
    const map = {
      '学习笔记':'study',
      '课程学习':'course',
      '技术栈':'tech',
      '课程':'course',
      '笔记':'notes'
    }
    if (map[t]) return map[t]
    return t
  }).filter(t => t && !blacklist.has(t) && !/^\d+$/.test(t))

  // remove very short non-Chinese tags (e.g., single latin letter)
  const final = mapped.filter(t => { if (/^[\u4e00-\u9fff]+$/.test(t)) return true; return t.length >= 2 })
  return Array.from(new Set(final)).slice(0, 6)
}

async function run({ apply = false } = {}) {
  const files = await walkMarkdownFiles(contentRoot)
  const report = []
  for (const file of files) {
    const txt = await readFile(file, 'utf8')
    const fm = extractFrontmatter(txt)
    const frontRaw = fm ? fm.raw : ''
    const existing = hasTags(frontRaw)
    if (!existing) {
      const suggested = suggestTags(file, txt, frontRaw)
      report.push({ file: path.relative(process.cwd(), file), suggested })
      if (apply) {
        let updated
        if (fm) {
          const before = txt.slice(0, fm.start + 3)
          const after = txt.slice(fm.end)
          // insert tags before closing ---
          const inserted = frontRaw.replace(/(\r?\n)$/, '') + '\n'
          const tagsBlock = suggested.length ? 'tags:\n' + suggested.map(t=>`  - ${t}`).join('\n') + '\n' : ''
          updated = before + inserted + tagsBlock + '---' + after
        } else {
          const tagsBlock = '---\ntags:\n' + suggested.map(t=>`  - ${t}`).join('\n') + '\n---\n' + txt
          updated = tagsBlock
        }
        await writeFile(file, updated, 'utf8')
      }
    }
  }
  // write report
  await writeFile(path.join(process.cwd(), 'quartz', '.tag-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), apply, items: report }, null, 2), 'utf8')
  console.log(`tag-normalize: processed ${files.length} files, missing-tags: ${report.length}, apply=${apply}`)
}

// CLI
const args = process.argv.slice(2)
const apply = args.includes('--apply') || args.includes('-a')
run({ apply }).catch(err => { console.error(err); process.exit(1) })
