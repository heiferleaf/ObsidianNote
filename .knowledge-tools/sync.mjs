import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { args, vaultRoot, sha256, readJSON, writeJSON, atomicWrite, withLock } from './registry.mjs'

// Only local transforms. The Agent obtains full snapshots with connected Pages tools.
const require = createRequire(path.join(vaultRoot, 'quartz/package.json'))
let parser, mathParser, matter
async function dependencies() {
  if (parser) return
  try {
    const [{ unified }, { default: remarkParse }, { default: remarkMath }] = await Promise.all(['unified', 'remark-parse', 'remark-math'].map(n => import(pathToFileURL(require.resolve(n)).href)))
    parser = unified().use(remarkParse)
    mathParser = unified().use(remarkParse).use(remarkMath)
    matter = require('gray-matter')
  } catch (error) { throw new Error(`Install the repository's Quartz dependencies before syncing: ${error.message}`) }
}
export function fullSnapshot(raw) {
  const p = raw.structuredContent ?? raw
  if (raw.isError || p.error) throw new Error(p.error?.message ?? 'Pages read failed')
  if (!p.content || !Array.isArray(p.content.blocks) || !p.content.page_id || typeof p.content.title !== 'string') throw new Error('Expected successful read_page structuredContent with content.blocks and title')
  if (p.metadata?.page_id && p.metadata.page_id !== p.content.page_id) throw new Error('Snapshot content and metadata identify different Pages')
  if (p.metadata?.document_type) throw new Error('Native artifacts need their own export; this command supports text Pages')
  if (p.block_excerpts || p.excerpt_selection || (p.selection && p.selection.whole_page_complete !== true)) throw new Error('Partial/excerpt reads cannot be synchronized; read the entire Page')
  if (p.metadata?.stream_kind && p.metadata.stream_kind !== 'content') throw new Error('Scratch streams are not note bodies')
  const ids = new Set()
  for (const b of p.content.blocks) {
    if (!b.id || typeof b.markdown !== 'string' || !b.hash || !['markdown', 'agent_instructions'].includes(b.kind) || ids.has(b.id)) throw new Error('Incomplete or duplicate canonical block')
    ids.add(b.id)
  }
  return p
}
function visualizationReferences(p) {
  return [...new Set(p.content.blocks.flatMap(b => [...b.markdown.replace(/\\([\\:()_])/g, '$1').matchAll(/visualize:[^\s)>"'\\]+/g)].map(m => m[0])))].sort()
}
export function remoteDigest(p, manifest) {
  const payload = { title: p.content.title, blocks: p.content.blocks.map(b => ({ id: b.id, kind: b.kind, markdown: b.markdown })) }
  const references = visualizationReferences(p)
  if (references.length) {
    if (!manifest) throw new Error('Visualization Pages require remoteDigest(page, manifest) so source mappings enter the baseline')
    payload.visualizations = references.map(reference => {
      const v = manifest.visualizations?.[reference]
      return { reference, mapping: v ? Object.fromEntries(['kind', 'key', 'markdown', 'source_sha256', 'embed_sha256', 'html_sha256', 'page_id', 'block_id', 'block_hash'].filter(k => v[k] !== undefined).map(k => [k, v[k]])) : null }
    })
  }
  return sha256(JSON.stringify(payload))
}

export function entries(manifest) {
  if (manifest.version !== 1) throw new Error('Unsupported manifest version; expected version:1')
  const collection = manifest.pages ?? manifest.notes
  if (!collection) throw new Error('Manifest needs pages keyed by page_id (or a notes array); see workflow.md')
  const rows = Array.isArray(collection) ? collection.map(v => [v.page_id, v]) : Object.entries(collection)
  const mapped = rows.map(([key, row]) => ({ row, id: row.page_id ?? key, path: row.path ?? row.local_path ?? (key.startsWith('002-学习笔记/') ? key : null) }))
  const ids = new Set(), paths = new Set()
  for (const e of mapped) {
    if (ids.has(e.id)) throw new Error(`Duplicate Page ID mapping: ${e.id}`)
    if (e.path?.endsWith('.md') && paths.has(e.path)) throw new Error(`Multiple Pages share local note path: ${e.path}`)
    ids.add(e.id)
    if (e.path) paths.add(e.path)
  }
  return mapped
}
function note(manifest, id) {
  const found = entries(manifest).filter(e => e.id === id)
  if (found.length !== 1 || !found[0].path?.endsWith('.md') || (found[0].row.kind && found[0].row.kind !== 'note')) throw new Error(`No unique managed note mapping for ${id}`)
  return found[0]
}
async function inside(root, relative, noteOnly = false) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw new Error(`Unsafe relative path: ${relative}`)
  if (noteOnly && (!relative.startsWith('002-学习笔记/') || !relative.endsWith('.md'))) throw new Error('Only Markdown beneath 002-学习笔记 is writable')
  const target = path.resolve(root, relative)
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Path escapes the vault')
  let cursor = target
  while (cursor !== path.resolve(root)) {
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error(`Symlink/reparse point is not a managed path: ${cursor}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    cursor = path.dirname(cursor)
  }
  return target
}
const readLocal = async file => fs.readFile(file).then(bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)).catch(error => { if (error.code === 'ENOENT') return null; throw error })
const baseURL = s => s?.split('#')[0]
const urlPath = s => s.split('/').map(encodeURIComponent).join('/')
const relativeURL = (source, target) => urlPath(path.posix.relative(path.posix.dirname(source), target) || path.posix.basename(target))
function assets(manifest) {
  const result = new Map()
  for (const [key, value] of Object.entries(manifest.attachments ?? manifest.assets ?? {})) {
    const row = typeof value === 'string' ? { path: value } : value
    const localPath = row.path ?? row.local_path ?? (!/^(?:library-file:|project-file:|https?:)/.test(key) ? key : null)
    for (const ref of [row.reference, row.url, key].filter(v => /^(?:library-file:|project-file:|visualize:|https?:)/.test(v ?? ''))) result.set(ref, { ...row, path: localPath })
  }
  return result
}
function splitFrontmatter(text) {
  if (text === null) return { prefix: '', body: '', data: {} }
  const match = text.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/)
  const data = matter(text).data
  return { prefix: match?.[0] ?? '', body: text.slice(match?.[0].length ?? 0), data }
}
function withFrontmatter(body, original, entry, title) {
  const parsed = splitFrontmatter(original)
  const tags = entry.path.split('/').slice(1, -1)
  let prefix = parsed.prefix
  if (!prefix) {
    const now = new Date().toISOString()
    prefix = `---\ntitle: ${JSON.stringify(title ?? path.posix.basename(entry.path, '.md'))}\ncreated: ${JSON.stringify(now)}\nmodified: ${JSON.stringify(now)}\ntags: ${JSON.stringify(tags)}\nsubject: ${JSON.stringify(tags.at(-1) ?? '学习')}\n---\n`
  } else if (!Object.hasOwn(parsed.data, 'tags')) {
    const nl = prefix.includes('\r\n') ? '\r\n' : '\n'
    prefix = prefix.replace(/(?:---|\.\.\.)(\r?\n)?$/, `tags: ${JSON.stringify(tags)}${nl}---${nl}`)
  }
  return prefix + body.replace(/^\n+/, '').replace(/\s*$/, '\n')
}
function mathFences(markdown) {
  // Walk all fenced blocks; a literal ```math inside another code block stays code.
  const lines = markdown.split('\n'), out = []
  for (let i = 0; i < lines.length; i++) {
    const opening = lines[i].match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/)
    if (!opening) { out.push(lines[i]); continue }
    const fence = opening[1], start = i, close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`)
    while (++i < lines.length && !close.test(lines[i])) {}
    if (i === lines.length) { out.push(...lines.slice(start)); break }
    const math = /^(math|latex|tex)\s*$/i.test(opening[2].trim())
    out.push(math ? '$$' : lines[start], ...lines.slice(start + 1, i), math ? '$$' : lines[i])
  }
  return out.join('\n')
}
function nativeMath(markdown) {
  const edits = [], inline = [], nested = []
  function walk(node, parent) {
    if (node.type === 'inlineMath') inline.push({ start: node.position.start.offset, end: node.position.end.offset })
    if (node.type === 'math') {
      if (parent?.type !== 'root') nested.push({ start: node.position.start.offset, end: node.position.end.offset })
      else {
        const fence = '`'.repeat(Math.max(3, ...[...node.value.matchAll(/`+/g)].map(m => m[0].length + 1)))
        edits.push({ start: node.position.start.offset, end: node.position.end.offset, text: fence + 'math\n' + node.value + '\n' + fence })
      }
    }
    for (const child of node.children ?? []) walk(child, node)
  }
  walk(mathParser.parse(markdown))
  for (const e of edits.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, e.start) + e.text + markdown.slice(e.end)
  return { markdown, inline, nested }
}
function activeVisualizations(markdown) {
  const references = []
  function walk(node) {
    if (['code', 'inlineCode'].includes(node.type)) return
    if (node.url?.startsWith('visualize:')) references.push(node.url)
    if (node.type === 'html') references.push(...[...node.value.matchAll(/visualize:[^\s)>"']+/g)].map(m => m[0]))
    for (const child of node.children ?? []) walk(child)
  }
  walk(parser.parse(markdown))
  return references
}
function expandMathRegions(p, manifest, entry) {
  const regions = [], issues = [], blocks = []
  for (const b of p.content.blocks.filter(b => b.kind === 'markdown')) {
    const refs = activeVisualizations(b.markdown)
    if (!refs.length) { blocks.push(b.markdown); continue }
    const tree = parser.parse(b.markdown), paragraph = tree.children[0], image = paragraph?.children?.[0]
    const ref = refs[0], source = manifest.visualizations?.[ref]
    let error
    if (tree.children.length !== 1 || paragraph.type !== 'paragraph' || paragraph.children.length !== 1 || image.type !== 'image' || image.url !== ref || refs.length !== 1) error = 'Visualization must be a standalone image-style embed'
    else if (source?.kind !== 'math_region') error = 'Unregistered or generic visualization is not a math region'
    else if (!source.key || typeof source.markdown !== 'string' || !source.markdown.trim()) error = 'Math region has no nonempty registered source/key'
    else if (source.source_sha256 !== sha256(source.markdown)) error = 'Math region source SHA256 mismatch'
    else if (!source.embed_sha256 || source.embed_sha256 !== sha256(b.markdown)) error = 'Math region embed changed or lacks its observed embed_sha256 guard'
    else if (source.page_id && source.page_id !== p.content.page_id || source.block_id && source.block_id !== b.id || source.block_hash && source.block_hash !== b.hash) error = 'Math region Page/block guard mismatch'
    else if (activeVisualizations(source.markdown).length) error = 'Nested visualization in math region source is unsupported'
    const previous = entry.row.baseline?.visualizations?.[ref]
    if (!error && previous && previous.source_sha256 !== source.source_sha256) error = 'Source changed under an existing immutable visualization reference; render a fresh embed'
    if (error) { issues.push(`[visualization] ${ref}: ${error}`); blocks.push(b.markdown); continue }
    regions.push({ reference: ref, key: source.key, markdown: source.markdown, source_sha256: source.source_sha256, embed_sha256: source.embed_sha256, html_sha256: source.html_sha256, block_id: b.id, block_hash: b.hash, embed_markdown: b.markdown })
    blocks.push(source.markdown)
  }
  return { body: blocks.join('\n\n'), regions, issues }
}
async function rewriteMarkdown(markdown, transform, wikiTransform) {
  const tree = parser.parse(markdown), edits = []
  const imageReferences = new Set()
  function collect(node) {
    if (node.type === 'imageReference') imageReferences.add(node.identifier)
    for (const child of node.children ?? []) collect(child)
  }
  collect(tree)
  async function visit(node) {
    if (['code', 'inlineCode'].includes(node.type)) return
    const start = node.position?.start.offset, end = node.position?.end.offset
    if (['link', 'image', 'definition'].includes(node.type)) {
      const transformed = await transform(node.url, node.type === 'image' || node.type === 'definition' && imageReferences.has(node.identifier), node.type)
      const dest = typeof transformed === 'string' ? transformed : transformed.url
      const suffix = typeof transformed === 'string' ? '' : transformed.label_suffix ?? ''
      if (dest !== node.url || suffix) {
        const title = node.title ? ` ${JSON.stringify(node.title)}` : ''
        if (node.type === 'definition') edits.push({ start, end, text: `[${node.label ?? node.identifier}]: <${dest}>${title}` })
        else {
          const label = node.type === 'image' ? (node.alt ?? '').replace(/\]/g, '\\]') : node.children?.length ? markdown.slice(node.children[0].position.start.offset, node.children.at(-1).position.end.offset) : ''
          edits.push({ start, end, text: `${node.type === 'image' ? '!' : ''}[${label}${suffix}](<${dest}>${title})` })
        }
      }
      return
    }
    if (node.type === 'html') {
      let html = node.value
      const matches = [...html.matchAll(/\b(src|href)=(['"])(.*?)\2/gi)]
      for (const m of matches.reverse()) {
        const converted = await transform(m[3], m[1].toLowerCase() === 'src', 'html')
        const dest = typeof converted === 'string' ? converted : converted.url
        html = html.slice(0, m.index) + `${m[1]}=${m[2]}${dest}${m[2]}` + html.slice(m.index + m[0].length)
      }
      if (html !== node.value) edits.push({ start, end, text: html })
    }
    if (node.type === 'text' && wikiTransform) {
      const raw = markdown.slice(start, end), matches = [...raw.matchAll(/(!?)\[\[([^\]]+)\]\]/g)]
      for (const m of matches) {
        const [target, alias] = m[2].split('|'), transformed = await wikiTransform(target, Boolean(m[1]))
        const dest = typeof transformed === 'string' ? transformed : transformed?.url
        const suffix = typeof transformed === 'object' ? transformed?.label_suffix ?? '' : ''
        if (dest != null) edits.push({ start: start + m.index, end: start + m.index + m[0].length, text: `${m[1]}[${alias ?? target.split('/').at(-1)}${suffix}](<${dest}>)` })
      }
    }
    for (const child of node.children ?? []) await visit(child)
  }
  await visit(tree)
  for (const e of edits.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, e.start) + e.text + markdown.slice(e.end)
  return markdown
}

export async function render(p, manifest, entry, root = vaultRoot) {
  await dependencies()
  const issues = [], warnings = [], refs = assets(manifest), all = entries(manifest)
  const expanded = expandMathRegions(p, manifest, entry)
  issues.push(...expanded.issues)
  async function assetURL(raw, image) {
    const native = raw.replace(/^file:/, '').replace(/#display=.*$/, '')
    if (native.startsWith('visualize:')) { issues.push(`[visualization] ${raw}: visualization was not expanded from a guarded math source`); return raw }
    const a = refs.get(native) ?? refs.get(raw)
    if (a) {
      if (!a.path) { issues.push(`Attachment has no local path: ${raw}`); return raw }
      try {
        const filename = await inside(root, a.path), bytes = await fs.readFile(filename)
        if (a.sha256 && sha256(bytes) !== a.sha256) throw new Error('Attachment SHA256 mismatch')
        return relativeURL(entry.path, a.path)
      } catch (error) { issues.push(`Attachment not materialized: ${raw}: ${error.message}`); return raw }
    }
    if (/^(?:library-file:|project-file:|visualize:)/.test(native) || (image && /^(?:https?:|data:)/.test(raw))) issues.push(`Attachment must be downloaded and mapped: ${raw}`)
    else if (image) {
      let decoded
      try { decoded = decodeURIComponent(raw.split('#')[0]) } catch { decoded = raw }
      const candidates = [...new Set([path.posix.normalize(path.posix.join(path.posix.dirname(entry.path), decoded)), decoded])]
      for (const local of candidates) {
        try { await fs.readFile(await inside(root, local)); return relativeURL(entry.path, local) }
        catch {}
      }
      issues.push(`Local image does not exist: ${raw}`)
    }
    return null
  }
  async function transform(raw, image) {
    const asset = await assetURL(raw, image)
    if (asset !== null) return asset
    const target = raw.startsWith('#') ? entry : all.find(e => e.row.url && baseURL(e.row.url) === baseURL(raw))
    if (!target) return raw
    if (!target.path) { warnings.push(`Page has no local mirror: ${raw}`); return raw }
    const fragment = raw.includes('#') ? raw.slice(raw.indexOf('#')) : ''
    if (!fragment) return relativeURL(entry.path, target.path)
    const mapping = manifest.block_links?.[raw]
    if (mapping?.verified === true && mapping.page_id === target.id && mapping.block_id && mapping.local_fragment) {
      const body = await readLocal(await inside(root, target.path))
      const anchor = mapping.local_fragment.replace(/^#/, '')
      const exists = anchor.startsWith('^') ? body?.split(/\r?\n/).some(line => line.trimEnd().endsWith(anchor)) : body?.includes(`id="${anchor}"`) || body?.includes(`id='${anchor}'`)
      if (exists) return relativeURL(entry.path, target.path) + '#' + anchor
    }
    warnings.push(`Unverified block/heading link downgraded to Page link; verify an explicit section name in its label: ${raw}`)
    const suffix = mapping?.section_title ? `（章节：${mapping.section_title.replace(/[\[\]]/g, '')}）` : ''
    return { url: relativeURL(entry.path, target.path), label_suffix: suffix }
  }
  let body = expanded.body
  if (p.content.blocks.some(b => b.kind === 'agent_instructions')) warnings.push('Agent instruction blocks retained in raw export, excluded from learning Markdown')
  // Native inline math cannot be treated as a successfully rendered Page paragraph.
  for (const b of p.content.blocks.filter(b => b.kind === 'markdown' && !activeVisualizations(b.markdown).length)) {
    if (nativeMath(b.markdown).inline.length) issues.push('[visualization] Native inline math requires a registered rendered math region')
  }
  body = mathFences(await rewriteMarkdown(body, transform))
  for (const region of expanded.regions) region.local_markdown = mathFences(await rewriteMarkdown(region.markdown, transform)).trim()
  return { body, regions: expanded.regions, visualization_issues: issues.filter(i => i.startsWith('[visualization]')), issues: [...new Set(issues)], warnings: [...new Set(warnings)] }
}

export async function plan(p, manifest, root = vaultRoot) {
  const entry = note(manifest, p.content.page_id), file = await inside(root, entry.path, true), local = await readLocal(file)
  const remote = remoteDigest(p, manifest), localHash = local === null ? null : sha256(local), baseline = entry.row.baseline
  const rendered = await render(p, manifest, entry, root)
  let status
  if (entry.row.migration_status !== 'verified') status = 'blocked-migration'
  else if (!baseline?.remote_sha256 || !baseline?.local_sha256) status = local === null ? 'new-remote' : 'unbased'
  else if (local === null) status = 'conflict-local-deleted'
  else {
    const r = remote !== baseline.remote_sha256, l = localHash !== baseline.local_sha256
    status = r && l ? 'conflict' : r ? 'remote-only' : l ? 'local-only' : 'unchanged'
  }
  if (['remote-only', 'new-remote'].includes(status) && !rendered.body.trim()) status = 'blocked-empty'
  if (rendered.issues.length && ['remote-only', 'new-remote'].includes(status)) status = 'blocked-assets'
  if (rendered.visualization_issues.length && !['conflict', 'conflict-local-deleted', 'blocked-migration'].includes(status)) status = 'blocked-visualization'
  return { page_id: entry.id, path: entry.path, status, remote_sha256: remote, local_sha256: localHash, baseline: baseline ?? null, issues: rendered.issues, warnings: rendered.warnings, _entry: entry, _local: local, _rendered: rendered, _file: file }
}
const publicPlan = p => Object.fromEntries(Object.entries(p).filter(([key]) => !key.startsWith('_')))
function nextBaseline(remote, local, regions) {
  const value = { remote_sha256: remote, local_sha256: local, synced_at: new Date().toISOString() }
  if (regions.length) value.visualizations = Object.fromEntries(regions.map(r => [r.reference, { key: r.key, source_sha256: r.source_sha256, embed_sha256: r.embed_sha256, ...(r.html_sha256 ? { html_sha256: r.html_sha256 } : {}) }]))
  return value
}
async function capture(raw, p, root) {
  if (!/^[A-Za-z0-9_-]+$/.test(p.content.page_id)) throw new Error('Page ID cannot be used as an export filename')
  const file = path.join(root, '.knowledge/exports', `${p.content.page_id}.json`)
  await writeJSON(file, raw)
  return file
}
async function baseline(p, manifestFile, root, expectedLocal) {
  return withLock(manifestFile, async () => {
    const manifest = await readJSON(manifestFile), result = await plan(p, manifest, root)
    if (result.status !== 'unbased' || result.issues.length || !result._rendered.body.trim()) throw new Error(`Initial baseline requires a verified nonempty Page with existing local note and no asset issues; got ${result.status}`)
    if (!expectedLocal || result.local_sha256 !== expectedLocal) throw new Error('Pass --expected-local with the reviewed current local SHA256')
    result._entry.row.baseline = nextBaseline(result.remote_sha256, result.local_sha256, result._rendered.regions)
    await writeJSON(manifestFile, manifest)
    return publicPlan(result)
  })
}
async function pull(raw, p, manifestFile, root) {
  return withLock(manifestFile, async () => {
    const manifest = await readJSON(manifestFile), result = await plan(p, manifest, root)
    await capture(raw, p, root)
    if (!['remote-only', 'new-remote'].includes(result.status)) return { ...publicPlan(result), applied: false }
    const text = withFrontmatter(result._rendered.body, result._local, result._entry, p.content.title)
    // Verify again immediately before replacing the note; another local editor may have saved it.
    const current = await readLocal(result._file)
    if ((current === null ? null : sha256(current)) !== result.local_sha256) throw new Error('Local changed during sync; retry planning')
    await fs.mkdir(path.dirname(result._file), { recursive: true })
    await atomicWrite(result._file, text)
    // Note-first ordering makes a crash conservative: the old baseline will yield conflict.
    result._entry.row.baseline = nextBaseline(result.remote_sha256, sha256(text), result._rendered.regions)
    await writeJSON(manifestFile, manifest)
    return { ...publicPlan(result), applied: true, written_sha256: sha256(text) }
  })
}
function preserveMathEmbeds(body, regions) {
  const nodes = mathParser.parse(body).children
  const starts = new Set(nodes.map(n => n.position.start.offset)), ends = new Set(nodes.map(n => n.position.end.offset))
  const edits = [], issues = [], counts = new Map()
  for (const r of regions) counts.set(r.local_markdown, (counts.get(r.local_markdown) ?? 0) + 1)
  const candidates = new Map()
  for (const [text, count] of counts) {
    const offsets = []
    for (let offset = body.indexOf(text); text && offset !== -1; offset = body.indexOf(text, offset + text.length)) {
      if (starts.has(offset) && ends.has(offset + text.length)) offsets.push(offset)
    }
    candidates.set(text, offsets.length === count ? offsets : [])
  }
  let previousEnd = 0
  for (const r of regions) {
    const offset = candidates.get(r.local_markdown)?.shift()
    if (offset === undefined || offset < previousEnd) { issues.push(`requires_formula_render: Update/remove/reorder math region ${r.key} with the renderer and its source mapping`); continue }
    edits.push({ start: offset, end: offset + r.local_markdown.length, text: r.embed_markdown })
    previousEnd = offset + r.local_markdown.length
  }
  for (const e of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, e.start) + e.text + body.slice(e.end)
  return { body, issues }
}
async function preparePush(p, manifest, root) {
  const result = await plan(p, manifest, root)
  if (result.status !== 'local-only') throw new Error(`Prepare push requires local-only; got ${result.status}`)
  const parsed = splitFrontmatter(result._local), all = entries(manifest), refs = assets(manifest), issues = [...result.issues]
  async function convert(raw, image, wiki = false) {
    if (image && /^(?:https?:|data:)/.test(raw) && !refs.has(raw)) issues.push(`Download and map the image before pushing: ${raw}`)
    if (/^(?:https?:|mailto:|tel:|library-file:|project-file:|visualize:)/.test(raw)) return raw
    const [name, ...fragments] = raw.split('#'), fragment = fragments.join('#')
    let decoded
    try { decoded = decodeURIComponent(name) } catch { decoded = name }
    const candidates = [...new Set([path.posix.normalize(path.posix.join(path.posix.dirname(result.path), decoded)), path.posix.normalize(decoded)])]
    let matches = all.filter(e => candidates.includes(e.path) || candidates.includes(e.path?.replace(/\.md$/, '')))
    if (!name) matches = [result._entry]
    if (wiki && !matches.length) matches = all.filter(e => path.posix.basename(e.path ?? '', '.md') === decoded)
    if (!image && matches.length === 1) {
      const target = matches[0]
      if (fragment) {
        const verified = Object.entries(manifest.block_links ?? {}).find(([, value]) => value.verified === true && value.page_id === target.id && value.local_fragment?.replace(/^#/, '') === fragment)
        if (verified) return verified[0]
        const named = Object.entries(manifest.block_links ?? {}).find(([, value]) => value.page_id === target.id && value.local_fragment?.replace(/^#/, '') === fragment && value.section_title)
        if (named && target.row.url) return { url: target.row.url, label_suffix: `（章节：${named[1].section_title.replace(/[\[\]]/g, '')}）` }
        issues.push(`Resolve the actual section title before replacing this local fragment with a Page link: ${raw}`); return raw
      }
      if (target.row.url) return target.row.url
    }
    const asset = [...refs.entries()].find(([, value]) => candidates.includes(value.path))
    if (asset) {
      try {
        const bytes = await fs.readFile(await inside(root, asset[1].path))
        if (asset[1].sha256 && sha256(bytes) !== asset[1].sha256) throw new Error('Attachment bytes changed; upload a new revision')
      } catch (error) { issues.push(`${raw}: ${error.message}`) }
      return asset[0]
    }
    issues.push(`Resolve or upload local reference before pushing: ${raw}`)
    return raw
  }
  const preserved = preserveMathEmbeds(parsed.body.replace(/\r\n/g, '\n'), result._rendered.regions)
  issues.push(...preserved.issues)
  const math = nativeMath(preserved.body)
  if (math.inline.length) issues.push('requires_formula_render: Render inline-math paragraphs with their inline code, then update the embed and registered source together')
  if (math.nested.length) issues.push('requires_formula_render: Render nested display math without flattening its list/quote structure')
  const body = await rewriteMarkdown(math.markdown, (raw, image) => convert(raw, image), (raw, image) => convert(raw, image, true))
  const metadataOnly = parsed.body.replace(/\r\n/g, '\n').trim() === result._rendered.body.replace(/\r\n/g, '\n').trim()
  return { version: 1, kind: 'pages-push-request', page_id: p.content.page_id, path: result.path, expected_local_sha256: result.local_sha256, previous_remote_sha256: result.remote_sha256, metadata_only: metadataOnly, requires_formula_render: issues.some(i => i.startsWith('requires_formula_render:')), formula_regions: result._rendered.regions, body_markdown: body, local_frontmatter: parsed.prefix, issues: [...new Set(issues)], observed_guards: { through_sequence: p.content.through_sequence, title_hash: p.content.title_hash, blocks: p.content.blocks }, created_at: new Date().toISOString() }
}
async function ackPush(raw, p, manifestFile, root, request, verified) {
  const formulaOnly = request.requires_formula_render && request.issues?.length && request.issues.every(i => i.startsWith('requires_formula_render:'))
  if (!verified || request.kind !== 'pages-push-request' || request.issues?.length && !formulaOnly || request.page_id !== p.content.page_id) throw new Error('Ack requires the original push request, resolved issues and --verified after Agent readback')
  return withLock(manifestFile, async () => {
    const manifest = await readJSON(manifestFile), entry = note(manifest, request.page_id)
    if (entry.path !== request.path || entry.row.migration_status !== 'verified') throw new Error('Mapping or migration state changed')
    const local = await readLocal(await inside(root, entry.path, true))
    if (local === null || sha256(local) !== request.expected_local_sha256 || entry.row.baseline?.remote_sha256 !== request.previous_remote_sha256) throw new Error('Local note or baseline changed since push preparation')
    const rendered = await render(p, manifest, entry, root), remote = remoteDigest(p, manifest)
    if (rendered.issues.length) throw new Error(`Post-push content is blocked: ${rendered.issues.join('; ')}`)
    if (formulaOnly && splitFrontmatter(local).body.replace(/\r\n/g, '\n').trim() !== rendered.body.replace(/\r\n/g, '\n').trim()) throw new Error('Rendered math sources and the complete post-push body must match the prepared local note')
    if (request.metadata_only) {
      const body = splitFrontmatter(local).body.replace(/\r\n/g, '\n').trim()
      if (remote !== request.previous_remote_sha256 || body !== rendered.body.replace(/\r\n/g, '\n').trim()) throw new Error('Metadata-only acknowledgement requires unchanged remote and matching body')
    } else if (remote === request.previous_remote_sha256) throw new Error('Remote content did not change; verify that the write committed')
    await capture(raw, p, root)
    entry.row.baseline = nextBaseline(remote, sha256(local), rendered.regions)
    await writeJSON(manifestFile, manifest)
    return { page_id: entry.id, acknowledged: true, baseline: entry.row.baseline }
  })
}

async function formulaSelfTest(root, manifestFile, initialManifest) {
  const m = structuredClone(initialManifest), id = 'page-formula', localPath = '002-学习笔记/技术栈/Formula.md', file = path.join(root, ...localPath.split('/'))
  m.pages[id] = { page_id: id, kind: 'note', path: localPath, migration_status: 'verified', url: 'https://chatgpt.com/space/page-formula' }
  const source1 = '参数 $x$ 与 `threshold` 在同一句。\n\n```math\nx^2\n```\n\n[Next](https://chatgpt.com/space/page-b)'
  const source2 = '连续下一段 $y+1$，保留 `$literal$`。\n\n![image](library-file:image)'
  const embed1 = '![math one](visualize:region-1)', embed2 = '![math two](visualize\\:region-2)'
  const p = { content: { page_id: id, title: 'Formula', title_hash: 'fh', blocks: [{ id: 'f0', hash: 'h0', kind: 'markdown', markdown: '原生正文与 `ordinary`。' }, { id: 'f1', hash: 'h1', kind: 'markdown', markdown: embed1 }, { id: 'f2', hash: 'h2', kind: 'markdown', markdown: embed2 }] }, metadata: { page_id: id, url: m.pages[id].url } }
  const mapping = (source, embed, key) => ({ kind: 'math_region', key, markdown: source, source_sha256: sha256(source), embed_sha256: sha256(embed), page_id: id, provenance: { keep: true } })
  m.visualizations = { 'visualize:region-1': mapping(source1, embed1, 'first'), 'visualize:region-2': mapping(source2, embed2, 'second') }
  await writeJSON(manifestFile, m)
  const rendered = await render(p, m, note(m, id), root)
  assert.equal(rendered.issues.length, 0)
  assert.ok(rendered.body.indexOf('参数 $x$') < rendered.body.indexOf('连续下一段 $y+1$'))
  assert.ok(rendered.body.includes('`threshold`') && rendered.body.includes('`$literal$`'))
  assert.ok(rendered.body.includes('$$\nx^2\n$$'))
  assert.ok(rendered.body.includes('[Next](<B.md>)') && rendered.body.includes('../../003-Attachments/a.png'))
  assert.ok(!rendered.body.includes('visualize:') && !rendered.body.includes('公式编号'))
  const native = nativeMath('$$\nx^2\n$$\n\n`$sample$`\n\n```js\nconst x = "$$"\n```')
  assert.ok(native.markdown.startsWith('```math\nx^2\n```'))
  assert.ok(native.markdown.includes('`$sample$`') && native.markdown.includes('const x = "$$"'))
  assert.equal(native.inline.length, 0)
  assert.ok(mathFences(native.markdown).startsWith('$$\nx^2\n$$'))
  const nestedMath = nativeMath('> $$\n> x^2\n> $$')
  assert.equal(nestedMath.nested.length, 1)
  assert.equal(nestedMath.markdown, '> $$\n> x^2\n> $$')
  assert.equal((await pull(p, p, manifestFile, root)).applied, true)
  let db = await readJSON(manifestFile), mirror = await fs.readFile(file, 'utf8')
  assert.equal((await plan(p, db, root)).status, 'unchanged')
  assert.equal(Object.keys(db.pages[id].baseline.visualizations).length, 2)
  const assertBlocked = async (page, changedManifest, pattern) => {
    const result = await plan(page, changedManifest, root)
    assert.equal(result.status, 'blocked-visualization')
    assert.ok(result.issues.some(i => pattern.test(i)))
  }
  const unknown = structuredClone(p); unknown.content.blocks[1].markdown = '![unknown](visualize:unregistered)'
  await assertBlocked(unknown, db, /Unregistered/)
  const badSha = structuredClone(db); badSha.visualizations['visualize:region-1'].source_sha256 = 'bad'
  await assertBlocked(p, badSha, /source SHA256/)
  const empty = structuredClone(db); empty.visualizations['visualize:region-1'].markdown = ''; empty.visualizations['visualize:region-1'].source_sha256 = sha256('')
  await assertBlocked(p, empty, /nonempty/)
  const generic = structuredClone(db); generic.visualizations['visualize:region-1'].kind = 'chart'; generic.attachments['visualize:region-1'] = { path: '003-Attachments/a.png' }
  await assertBlocked(p, generic, /generic/)
  const modifiedEmbed = structuredClone(p); modifiedEmbed.content.blocks[1].markdown = '![changed title](visualize:region-1)'
  await assertBlocked(modifiedEmbed, db, /embed changed/)
  const missingGuard = structuredClone(db); delete missingGuard.visualizations['visualize:region-1'].embed_sha256
  await assertBlocked(p, missingGuard, /embed_sha256/)
  const editedMap = structuredClone(db)
  editedMap.visualizations['visualize:region-1'].markdown += '\n\nChanged source'
  editedMap.visualizations['visualize:region-1'].source_sha256 = sha256(editedMap.visualizations['visualize:region-1'].markdown)
  assert.notEqual(remoteDigest(p, editedMap), remoteDigest(p, db))
  await assertBlocked(p, editedMap, /immutable visualization/)
  await fs.appendFile(file, '\nLocal changed too\n')
  assert.equal((await plan(p, editedMap, root)).status, 'conflict')
  await writeJSON(manifestFile, editedMap)
  assert.equal((await pull(p, p, manifestFile, root)).applied, false)
  assert.ok((await fs.readFile(file, 'utf8')).includes('Local changed too'))
  await fs.writeFile(file, mirror)
  await writeJSON(manifestFile, db)
  await fs.appendFile(file, '\n仅修改原生段落及 `plainCode`。\n')
  const plainRequest = await preparePush(p, db, root)
  assert.equal(plainRequest.requires_formula_render, false)
  assert.equal(plainRequest.issues.length, 0)
  assert.ok(plainRequest.body_markdown.includes(embed1) && plainRequest.body_markdown.includes(embed2))
  assert.ok(plainRequest.body_markdown.includes('`plainCode`') && !plainRequest.body_markdown.includes('参数 $x$'))
  const plainPost = structuredClone(p); plainPost.content.blocks.push({ id: 'f3', hash: 'h3', kind: 'markdown', markdown: '仅修改原生段落及 `plainCode`。' })
  await ackPush(plainPost, plainPost, manifestFile, root, plainRequest, true)
  db = await readJSON(manifestFile)
  assert.deepEqual(db.visualizations, m.visualizations)
  mirror = await fs.readFile(file, 'utf8')
  await fs.writeFile(file, mirror.replace('参数 $x$', '参数 $z$'))
  const formulaRequest = await preparePush(plainPost, db, root)
  assert.equal(formulaRequest.requires_formula_render, true)
  assert.ok(formulaRequest.issues.every(i => i.startsWith('requires_formula_render:')))
  const rawPost = structuredClone(plainPost); rawPost.content.blocks[1].markdown = source1.replace('参数 $x$', '参数 $z$')
  await assert.rejects(ackPush(rawPost, rawPost, manifestFile, root, formulaRequest, true), /blocked/)
  const newEmbed = '![updated math](visualize:region-3)', updated = structuredClone(plainPost)
  updated.content.blocks[1].markdown = newEmbed
  const htmlOnly = structuredClone(db); htmlOnly.visualizations['visualize:region-3'] = mapping(source1, newEmbed, 'third')
  await writeJSON(manifestFile, htmlOnly)
  await assert.rejects(ackPush(updated, updated, manifestFile, root, formulaRequest, true), /must match/)
  const finalMap = structuredClone(db); finalMap.visualizations['visualize:region-3'] = mapping(source1.replace('参数 $x$', '参数 $z$'), newEmbed, 'third')
  await writeJSON(manifestFile, finalMap)
  await ackPush(updated, updated, manifestFile, root, formulaRequest, true)
  const final = await readJSON(manifestFile)
  assert.equal((await plan(updated, final, root)).status, 'unchanged')
  assert.deepEqual(final.visualizations, finalMap.visualizations)
  const missingAsset = structuredClone(final), missingPage = structuredClone(updated)
  const missingEmbed = '![new region](visualize:region-4)'
  missingPage.content.blocks[1].markdown = missingEmbed
  missingAsset.visualizations['visualize:region-4'] = mapping('参数 $z$\n\n![missing](library-file:missing)', missingEmbed, 'fourth')
  assert.equal((await plan(missingPage, missingAsset, root)).status, 'blocked-assets')
}

async function selfTest() {
  await dependencies()
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-sync-'))
  try {
    const p = { content: { page_id: 'page-a', title: 'Java', title_hash: 'title-hash', through_sequence: 1, blocks: [{ id: 'b1', hash: 'h1', kind: 'markdown', markdown: '# Java\n\n```math\nx^2\n```\n\n[Next](https://chatgpt.com/space/page-b)\n\n![image](library-file:image)' }] }, metadata: { url: 'https://chatgpt.com/space/page-a', stream_kind: 'content' } }
    const manifestFile = path.join(root, '.knowledge/manifest.json'), localPath = '002-学习笔记/技术栈/Java.md'
    const localFile = path.join(root, ...localPath.split('/'))
    await fs.mkdir(path.dirname(localFile), { recursive: true })
    await fs.mkdir(path.join(root, '003-Attachments'))
    await fs.writeFile(path.join(root, '003-Attachments/a.png'), 'image bytes')
    const original = '---\r\ntitle: Old\r\ntags: [人工标签]\r\ncustom: keep\r\n---\r\nOriginal\n'
    await fs.writeFile(localFile, original)
    const manifest = { version: 1, pages: { 'page-a': { page_id: 'page-a', kind: 'note', path: localPath, url: p.metadata.url, migration_status: 'placeholder' }, 'page-b': { page_id: 'page-b', path: '002-学习笔记/技术栈/B.md', url: 'https://chatgpt.com/space/page-b', kind: 'note', migration_status: 'verified' } }, attachments: { 'library-file:image': { path: '003-Attachments/a.png', sha256: sha256('image bytes') } } }
    await writeJSON(manifestFile, manifest)
    assert.equal((await plan(p, manifest, root)).status, 'blocked-migration')
    assert.equal((await pull(p, p, manifestFile, root)).applied, false)
    assert.equal(await fs.readFile(localFile, 'utf8'), original)
    manifest.pages['page-a'].migration_status = 'verified'
    await writeJSON(manifestFile, manifest)
    assert.equal((await plan(p, manifest, root)).status, 'unbased')
    await baseline(p, manifestFile, root, sha256(original))
    let db = await readJSON(manifestFile)
    assert.equal((await plan(p, db, root)).status, 'unchanged')
    const changed = structuredClone(p); changed.content.blocks[0].markdown += '\n\nUpdated'
    assert.equal((await plan(changed, db, root)).status, 'remote-only')
    await fs.appendFile(localFile, 'Local edit\n')
    assert.equal((await plan(changed, db, root)).status, 'conflict')
    assert.equal((await pull(changed, changed, manifestFile, root)).applied, false)
    await fs.writeFile(localFile, original)
    assert.equal((await pull(changed, changed, manifestFile, root)).applied, true)
    const mirrored = await fs.readFile(localFile, 'utf8')
    assert.ok(mirrored.startsWith(original.slice(0, original.indexOf('Original'))))
    assert.ok(mirrored.includes('$$\nx^2\n$$'))
    assert.ok(mirrored.includes('[Next](<B.md>)'))
    assert.ok(mirrored.includes('../../003-Attachments/a.png'))
    assert.ok((await readJSON(path.join(root, '.knowledge/exports/page-a.json'))).content)
    db = await readJSON(manifestFile)
    await fs.appendFile(localFile, '\nLocal addition\n')
    const request = await preparePush(changed, db, root)
    assert.equal(request.issues.length, 0)
    assert.ok(request.body_markdown.includes('https://chatgpt.com/space/page-b'))
    assert.ok(request.body_markdown.includes('library-file:image'))
    const post = structuredClone(changed); post.content.blocks[0].markdown += '\n\nLocal addition'
    await ackPush(post, post, manifestFile, root, request, true)
    db = await readJSON(manifestFile)
    assert.equal((await plan(post, db, root)).status, 'unchanged')
    await fs.writeFile(localFile, (await fs.readFile(localFile, 'utf8')).replace('custom: keep', 'custom: new metadata'))
    const metadataRequest = await preparePush(post, db, root)
    assert.equal(metadataRequest.metadata_only, true)
    await ackPush(post, post, manifestFile, root, metadataRequest, true)
    db = await readJSON(manifestFile)
    const missing = structuredClone(post); missing.content.blocks[0].markdown += '\n\n![New](library-file:missing)'
    assert.equal((await plan(missing, db, root)).status, 'blocked-assets')
    assert.throws(() => fullSnapshot({ ...p, selection: { whole_page_complete: false } }), /Partial/)
    assert.throws(() => fullSnapshot({ ...p, block_excerpts: [] }), /Partial/)
    const unsafe = structuredClone(db); unsafe.pages['page-a'].path = '../escape.md'
    await assert.rejects(plan(post, unsafe, root), /Unsafe/)
    const empty = structuredClone(post); empty.content.blocks = []
    assert.equal((await plan(empty, db, root)).status, 'blocked-empty')
    const rendered = await render({ ...p, content: { ...p.content, blocks: [{ ...p.content.blocks[0], markdown: '`![x](library-file:missing)`\n\n[Next](https://chatgpt.com/space/page-b#unverified)\n\n````js\n```math\nx\n```\n````' }] } }, db, note(db, 'page-a'), root)
    assert.equal(rendered.issues.length, 0)
    assert.ok(rendered.body.includes('```math'))
    assert.ok(rendered.warnings.length)
    assert.ok(!rendered.body.includes('#unverified'))
    const refImage = structuredClone(post); refImage.content.blocks[0].markdown = '![new][pic]\n\n[pic]: https://example.invalid/new.png'
    assert.ok((await render(refImage, db, note(db, 'page-a'), root)).issues.length)
    const html = structuredClone(post); html.content.blocks[0].markdown = '<a href="https://chatgpt.com/space/page-b#unknown">Known chapter</a>'
    assert.ok(!(await render(html, db, note(db, 'page-a'), root)).body.includes('[object Object]'))
    const duplicate = structuredClone(db); duplicate.pages['page-b'].path = localPath
    assert.throws(() => entries(duplicate), /share local note/)
    const newPage = structuredClone(post); newPage.content.page_id = 'page-b'
    assert.equal((await plan(newPage, db, root)).status, 'new-remote')
    await fs.rm(localFile)
    assert.equal((await plan(post, db, root)).status, 'conflict-local-deleted')
    const fm = withFrontmatter('Body', '---\ncustom: retained\n---\nOld', note(db, 'page-a'), 'Java')
    assert.ok(fm.includes('custom: retained\ntags: ["技术栈"]'))
    await formulaSelfTest(root, manifestFile, db)
    console.log('sync self-test: migration/empty guards, full-snapshot validation, baseline states, conflicts, raw export, metadata/tags, math/code, page links, assets, push/ack and path containment passed')
    console.log('formula roundtrip self-test: consecutive guarded sources, native math both ways, inline code, unknown/generic/changed/invalid embeds, mapping conflicts, native edits, renderer-required pushes, source/HTML consistency and missing assets passed')
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    await fs.rm(root, { recursive: true, force: true })
  }
}

async function main() {
  const a = args(process.argv.slice(2)), command = a._[0] ?? 'help'
  for (const flag of ['apply', 'accept-initial', 'verified']) if (a[flag] !== undefined && a[flag] !== true) throw new Error(`--${flag} is a standalone flag; do not supply a value`)
  if (command === 'help') return console.log('sync.mjs plan | render | capture | baseline | pull | prepare-push | ack-push --input full-read.json\nOptions: --manifest path --root vault --output file\nbaseline requires --accept-initial --expected-local SHA256; pull writes only with --apply; ack-push requires --request task.json --verified. No network calls. Run self-test for isolated checks.')
  if (command === 'self-test') return selfTest()
  if (!a.input) throw new Error('--input full read_page JSON is required')
  const root = path.resolve(a.root ?? vaultRoot), manifestFile = path.resolve(a.manifest ?? path.join(root, '.knowledge/manifest.json'))
  const output = a.output ? await outputFile(root, a.output) : null
  const raw = await readJSON(path.resolve(a.input)), p = fullSnapshot(raw)
  let result
  if (command === 'capture') result = { export: await capture(raw, p, root), remote_sha256: remoteDigest(p, await readJSON(manifestFile, { version: 1, pages: {} })) }
  else if (command === 'baseline') {
    if (!a['accept-initial']) throw new Error('Initial baselines require --accept-initial after comparing the migration with its source')
    result = await baseline(p, manifestFile, root, a['expected-local'])
  } else if (command === 'pull' && a.apply) result = await pull(raw, p, manifestFile, root)
  else if (command === 'ack-push') {
    if (!a.request) throw new Error('--request is required')
    result = await ackPush(raw, p, manifestFile, root, await readJSON(path.resolve(a.request)), a.verified)
  } else {
    const manifest = await readJSON(manifestFile)
    if (command === 'render') {
      const e = note(manifest, p.content.page_id), file = await inside(root, e.path, true), local = await readLocal(file), rendered = await render(p, manifest, e, root)
      if (rendered.issues.length) throw new Error(rendered.issues.join('\n'))
      const markdown = withFrontmatter(rendered.body, local, e, p.content.title)
      if (output) await atomicWrite(output, markdown)
      else process.stdout.write(markdown)
      return
    }
    if (command === 'prepare-push') result = await preparePush(p, manifest, root)
    else if (['plan', 'pull'].includes(command)) result = publicPlan(await plan(p, manifest, root))
    else throw new Error(`Unknown command: ${command}`)
  }
  if (output) await writeJSON(output, result)
  console.log(JSON.stringify(result, null, 2))
}
async function outputFile(root, output) {
  const relative = path.relative(root, path.resolve(output)).split(path.sep).join('/')
  if (!/^\.knowledge\/(previews|requests|reports)\//.test(relative)) throw new Error('--output must be beneath .knowledge/previews, requests, or reports; mirror writes require pull --apply')
  return inside(root, relative)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
