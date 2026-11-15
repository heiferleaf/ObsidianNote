import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { remark } from '../quartz/node_modules/remark/index.js'
import gfm from '../quartz/node_modules/remark-gfm/index.js'
import math from '../quartz/node_modules/remark-math/index.js'
import { fullSnapshot, remoteDigest, render } from './sync.mjs'
import { vaultRoot, sha256, args, writeJSON, withLock } from './registry.mjs'

// Local-only candidate builder. No Pages API and no writes to source notes or state.json.
// Default and --dry-run print a report only. --apply is an explicit, separate action.
const parser = remark().use(gfm).use(math)
const clone = value => structuredClone(value)
const json = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
const unique = values => [...new Set(values)]

async function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw Error(`Unsafe relative path: ${relative}`)
  const filename = path.resolve(root, relative)
  if (!filename.startsWith(path.resolve(root) + path.sep)) throw Error(`Path escapes vault: ${relative}`)
  // Reject existing symlink/reparse aliases rather than accepting a lexical prefix alone.
  const actual = await fs.realpath(filename).catch(error => { if (error.code === 'ENOENT') return filename; throw error })
  if (!actual.startsWith(path.resolve(root) + path.sep)) throw Error(`Resolved path escapes vault: ${relative}`)
  return filename
}

function standalone(markdown) {
  const tree = parser.parse(markdown), paragraph = tree.children[0], image = paragraph?.children?.[0]
  return tree.children.length === 1 && paragraph?.type === 'paragraph' && paragraph.children.length === 1 && image?.type === 'image' && image.url.startsWith('visualize:') ? image.url : null
}

function references(markdown) {
  const refs = []
  function walk(node) {
    if (node.type === 'code' || node.type === 'inlineCode') return
    if (node.url?.startsWith('visualize:')) refs.push(node.url)
    if (node.type === 'html') refs.push(...[...node.value.matchAll(/visualize:[^\s)>"'\\]+/g)].map(m => m[0]))
    for (const child of node.children ?? []) walk(child)
  }
  walk(parser.parse(markdown))
  return unique(refs)
}

function rawWikiReferences(markdown) {
  const ranges = []
  function walk(node) {
    if (node.type === 'code' || node.type === 'inlineCode') { ranges.push([node.position.start.offset, node.position.end.offset]); return }
    for (const child of node.children ?? []) walk(child)
  }
  walk(parser.parse(markdown))
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) markdown = markdown.slice(0, start) + markdown.slice(start, end).replace(/[^\n]/g, ' ') + markdown.slice(end)
  return unique([...markdown.matchAll(/(?<!\\)!?\[\[[^\r\n]*?\]\]/g)].map(match => match[0])).filter(reference => {
    // Numeric tensor/matrix literals are data, not Obsidian destinations.
    if (reference.startsWith('!')) return true
    try {
      const value = JSON.parse(reference)
      if (Array.isArray(value) && value.length >= 2 && value.every(row => Array.isArray(row) && row.length >= 2 && row.length === value[0].length && row.every(cell => typeof cell === 'number'))) return false
    } catch {}
    return true
  })
}

// Retain structure, links, code, tables, task state, math and ordered-list starts.
// Only positional data, list spread and prose whitespace are presentation details.
export function semanticSignature(markdown) {
  function clean(node) {
    if (node.type === 'code' && /^(math|latex|tex)$/i.test(node.lang ?? '')) return { type: 'math', value: node.value.trim() }
    if (node.type === 'math') return { type: 'math', value: node.value.trim() }
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (['position', 'spread', 'data'].includes(key)) continue
      if (key === 'children') out.children = value.map(clean)
      else if (key === 'value' && node.type === 'text') out.value = value.replace(/\s+/g, ' ')
      else if (key === 'value' && node.type === 'math') out.value = value.trim()
      else out[key] = value
    }
    return out
  }
  return JSON.stringify(clean(parser.parse(markdown.replace(/\r\n/g, '\n'))))
}

// Pages can serialize a fenced code block within the immediately preceding list
// item rather than beside that item. Accept that presentation change only when
// every code byte/language/meta and its order match, and every other nonempty
// Markdown line keeps its indentation, punctuation, order and hard-break state.
export function pageWhitespaceSignature(markdown) {
  markdown = markdown.replace(/\r\n/g, '\n')
  const codes = []
  function visit(node) {
    if (node.type === 'code') { codes.push(node); return }
    for (const child of node.children ?? []) visit(child)
  }
  visit(parser.parse(markdown))
  const values = codes.map(node => ({ lang: node.lang ?? null, meta: node.meta ?? null, value: node.value }))
  for (let i = codes.length - 1; i >= 0; i--) {
    const node = codes[i]
    markdown = markdown.slice(0, node.position.start.offset) + `<CODE:${i}>` + markdown.slice(node.position.end.offset)
  }
  const lines = markdown.split('\n').filter(line => line.trim()).map(line => ({
    text: /^[ \t]*<CODE:\d+>[ \t]*$/.test(line) ? line.trim() : line.trimEnd(),
    hard_break: / {2,}$/.test(line)
  }))
  return JSON.stringify({ codes: values, lines })
}

// This transform is usable only with an exact, Page-specific review below.
// Fenced/languaged code and every nonempty character remain fully strict.
export function reviewedIndentedProseSignature(markdown) {
  markdown = markdown.replace(/\r\n/g, '\n')
  const lines = markdown.split('\n'), original = parser.parse(markdown), canonical = JSON.parse(semanticSignature(markdown))
  function visit(raw, clean) {
    if (raw.type === 'code' && raw.lang == null && clean.type === 'code') {
      const opening = lines[raw.position.start.line - 1]
      if (/^(?: {4}|\t)/.test(opening) && !/^[\t ]*(?:>[\t ]*)*(?:`{3,}|~{3,})/.test(opening)) clean.value = raw.value.replace(/^[\t ]+$/gm, '').replace(/\n+$/, '')
    }
    for (let i = 0; i < (raw.children?.length ?? 0); i++) visit(raw.children[i], clean.children[i])
  }
  visit(original, canonical)
  return JSON.stringify(canonical)
}

// Exact Page review for math/native block boundaries. All code bytes, quoted
// markers/depths, step labels and nonempty line contents remain independently
// guarded; only the reviewed body's leading/blank-line presentation can differ.
export function reviewedMathBoundarySignature(markdown) {
  markdown = markdown.replace(/\r\n/g, '\n')
  const lines = markdown.split('\n').filter(line => line.trim()).map(line => ({ text: line.trim(), hard_break: / {2,}$/.test(line) }))
  const content = { code: [], inline_code: [], heading_depths: [], links: [], images: [], quote_depths: [], tasks: [] }
  function visit(node, quoteDepth = 0) {
    if (node.type === 'code') content.code.push({ lang: node.lang ?? null, meta: node.meta ?? null, value: node.value })
    if (node.type === 'inlineCode') content.inline_code.push(node.value)
    if (node.type === 'heading') content.heading_depths.push(node.depth)
    if (node.type === 'link') content.links.push({ url: node.url, title: node.title ?? null })
    if (node.type === 'image') content.images.push({ url: node.url, title: node.title ?? null, alt: node.alt ?? null })
    if (node.type === 'blockquote') { quoteDepth++; content.quote_depths.push(quoteDepth) }
    if (node.type === 'listItem' && typeof node.checked === 'boolean') content.tasks.push(node.checked)
    for (const child of node.children ?? []) visit(child, quoteDepth)
  }
  visit(parser.parse(markdown))
  return JSON.stringify({ lines, content })
}

export async function buildCandidate(root = vaultRoot, verify = false) {
  root = path.resolve(root)
  const inputGuards = new Map(), issues = [], noteIssues = new Map()
  const issue = (code, localPath, detail, pageId) => {
    const row = { code, ...(localPath ? { path: localPath } : {}), ...(pageId ? { page_id: pageId } : {}), ...(detail ? { detail } : {}) }
    issues.push(row)
    if (pageId) { if (!noteIssues.has(pageId)) noteIssues.set(pageId, []); noteIssues.get(pageId).push(row) }
  }
  async function load(relative, fallback) {
    const file = await inside(root, relative)
    try { const bytes = await fs.readFile(file); inputGuards.set(file, sha256(bytes)); return json(bytes) }
    catch (error) {
      if (error.code === 'ENOENT') { inputGuards.set(file, null); if (fallback !== undefined) return clone(fallback) }
      throw error
    }
  }
  async function bytes(relative) {
    const file = await inside(root, relative), value = await fs.readFile(file)
    inputGuards.set(file, sha256(value))
    return value
  }
  const state = await load('.knowledge/state.json')
  const inventory = await load('.knowledge/inventory.json')
  const index = await load('.knowledge/converted-v3-index.json')
  const attachments = await load('.knowledge/attachments.json')
  const formatReviews = await load('.knowledge/page-format-equivalence.json', { version: 1, pages: {} })
  if (formatReviews.version !== 1 || !formatReviews.pages || Array.isArray(formatReviews.pages)) throw Error('Unsupported Page format review schema')
  const previous = await load('.knowledge/manifest.json', { version: 1, pages: {}, attachments: {}, visualizations: {}, block_links: {} })
  const priorRegistry = await load('.knowledge/threads.json', { version: 1, threads: {}, pages: {} })
  if (state.version !== 1 || !state.pages || !Array.isArray(inventory.notes) || !Array.isArray(index)) throw Error('Unsupported state/inventory/converted-v3-index schema')
  if (previous.version !== 1 || !previous.pages || Array.isArray(previous.pages)) throw Error('Existing manifest is not v1 pages keyed by Page ID; adapt it before finalization')
  if (priorRegistry.version !== 1 || !priorRegistry.threads || !priorRegistry.pages) throw Error('Existing threads registry is not v1')
  const manifest = { ...clone(previous), version: 1, pages: clone(previous.pages), attachments: { ...clone(previous.attachments ?? {}), ...clone(attachments) }, visualizations: {}, block_links: clone(previous.block_links ?? {}) }
  const registry = clone(priorRegistry), snapshots = new Map(), noteByPath = new Map(), convertedByPath = new Map(), ids = new Set()
  for (const note of inventory.notes) {
    if (noteByPath.has(note.path)) throw Error(`Duplicate inventory path: ${note.path}`)
    noteByPath.set(note.path, note)
  }
  for (const row of index) { if (convertedByPath.has(row.path)) throw Error(`Duplicate converted path: ${row.path}`); convertedByPath.set(row.path, row) }
  for (const [localPath, source] of Object.entries(state.pages)) {
    const id = source.page_id
    if (typeof id !== 'string' || !id || ids.has(id)) throw Error(`Missing/duplicate Page ID for ${localPath}`)
    ids.add(id)
    const note = noteByPath.get(localPath), old = manifest.pages[id] ?? {}
    const row = { ...old, page_id: id, path: localPath, kind: source.kind, title: source.title, url: source.url, parent_page_id: source.parent_page_id }
    if (source.kind === 'note') {
      if (!note || !localPath.startsWith('002-学习笔记/') || !localPath.endsWith('.md')) issue('inventory-note-missing', localPath, null, id)
      const oldLink = registry.pages[id] ?? {}
      for (const existing of [old, oldLink]) {
        if (existing.origin != null && existing.origin !== 'imported') throw Error(`Imported-note origin conflict for ${localPath}`)
        if (existing.source_thread != null) throw Error(`Imported-note source_thread conflict for ${localPath}`)
        if (existing.maintainer_expert != null && (typeof existing.maintainer_expert !== 'string' || !existing.maintainer_expert.trim())) throw Error(`Invalid existing maintainer for ${localPath}`)
      }
      const maintainers = unique([old.maintainer_expert, oldLink.maintainer_expert].filter(value => value != null))
      if (maintainers.length > 1) throw Error(`Existing maintainer conflict for ${localPath}`)
      const maintainer = maintainers[0] ?? null
      row.origin = 'imported'; row.source_thread = null; row.maintainer_expert = maintainer
      row.source_frontmatter = clone(note?.data ?? {})
      const aliases = note?.data?.aliases ?? note?.data?.alias ?? []
      row.aliases = unique(Array.isArray(aliases) ? aliases.filter(v => typeof v === 'string') : typeof aliases === 'string' ? [aliases] : [])
      row.migration_status = 'pending'
      delete row.baseline
      registry.pages[id] = { ...oldLink, page_id: id, origin: 'imported', source_thread: null, maintainer_expert: maintainer, url: source.url, revision: oldLink.revision ?? 0 }
    }
    manifest.pages[id] = row
    try {
      const p = fullSnapshot(await load(`.knowledge/exports/${id}.json`))
      if (p.content.page_id !== id) throw Error('Export filename and content identify different Pages')
      if (p.content.title !== source.title) issue('snapshot-title-mismatch', localPath, null, id)
      if (p.metadata?.parent?.page_id !== source.parent_page_id) issue('snapshot-parent-mismatch', localPath, null, id)
      if (p.metadata?.url && p.metadata.url !== source.url) issue('snapshot-url-mismatch', localPath, null, id)
      snapshots.set(id, p)
    } catch (error) { if (source.kind === 'note') issue('snapshot-invalid-or-missing', localPath, error.message, id) }
  }
  for (const note of inventory.notes) if (!state.pages[note.path]) issue('state-note-missing', note.path)

  const threadInputs = [
    [state.controller, 'controller', 'Controller 学习知识库'],
    [state.curator, 'curator', '学习知识库归纳员'],
    ...Object.values(state.experts ?? {}).map(t => [t, 'expert', t.title])
  ]
  for (const [source, role, fallbackTitle] of threadInputs) {
    if (!source?.threadId || !source.hostId) { issue('thread-identity-missing', null, role); continue }
    const old = registry.threads[source.threadId] ?? {}
    registry.threads[source.threadId] = { ...old, ...clone(source), threadId: source.threadId, role, title: source.title ?? old.title ?? fallbackTitle, aliases: old.aliases ?? [], topics: old.topics ?? [], revision: old.revision ?? 0 }
  }
  for (const id of ids) {
    const row = manifest.pages[id]
    if (row.kind === 'note' && row.maintainer_expert && registry.threads[row.maintainer_expert]?.role !== 'expert') throw Error(`Existing maintainer is not a registered Expert for ${row.path}`)
  }

  const receiptsByRef = new Map()
  const receiptNames = (await fs.readdir(await inside(root, '.knowledge'))).filter(n => /^formula-receipts-.*\.jsonl$/.test(n)).sort()
  for (const name of receiptNames) {
    const text = (await bytes(`.knowledge/${name}`)).toString('utf8').replace(/^\uFEFF/, '')
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue
      let receipt
      try { receipt = JSON.parse(line) } catch { issue('receipt-invalid-json', `.knowledge/${name}`, `line ${lineIndex + 1}`); continue }
      const ref = typeof receipt.markdown === 'string' ? standalone(receipt.markdown) : null
      if (!ref || !receipt.key || !receipt.source_markdown?.trim() || ref !== `visualize:${receipt.file_reference}`) { issue('receipt-invalid-shape', `.knowledge/${name}`, `line ${lineIndex + 1}`); continue }
      const sourceHash = sha256(receipt.source_markdown)
      if (receipt.source_sha256 !== sourceHash) { issue('receipt-source-sha256-mismatch', receipt.path, ref); continue }
      const record = { ...receipt, source_sha256: sourceHash }
      if (!receiptsByRef.has(ref)) receiptsByRef.set(ref, [])
      receiptsByRef.get(ref).push(record)
    }
  }
  const occurrences = new Map()
  for (const [id, p] of snapshots) for (const b of p.content.blocks) for (const ref of references(b.markdown)) {
    if (!occurrences.has(ref)) occurrences.set(ref, [])
    occurrences.get(ref).push({ id, block: b })
  }
  for (const [ref, uses] of occurrences) {
    const receipts = receiptsByRef.get(ref) ?? []
    const fail = (code, detail) => { for (const use of uses) issue(code, manifest.pages[use.id].path, detail ?? ref, use.id) }
    if (!receipts.length) { fail('visualization-unregistered'); continue }
    const receipt = receipts[0]
    if (receipts.some(r => r.source_sha256 !== receipt.source_sha256 || r.key !== receipt.key || r.source_markdown !== receipt.source_markdown)) { fail('visualization-conflicting-receipts'); continue }
    if (uses.some(u => standalone(u.block.markdown) !== ref)) { fail('visualization-not-standalone'); continue }
    const embedHashes = unique(uses.map(u => sha256(u.block.markdown)))
    if (embedHashes.length !== 1) { fail('visualization-embed-guards-differ'); continue }
    if (references(receipt.source_markdown).length) { fail('visualization-nested-source'); continue }
    try {
      const html = await bytes(`.knowledge/${receipt.html_file}`)
      const htmlHash = sha256(html)
      if (receipt.html_sha256 && receipt.html_sha256 !== htmlHash) throw Error('HTML SHA256 differs from receipt')
      manifest.visualizations[ref] = { kind: 'math_region', key: receipt.key, markdown: receipt.source_markdown, source_sha256: sha256(receipt.source_markdown), embed_sha256: embedHashes[0], html_file: receipt.html_file, html_sha256: htmlHash }
    } catch (error) { fail('visualization-html-invalid-or-missing', `${ref}: ${error.message}`) }
  }
  for (const [ref, attachment] of Object.entries(attachments)) {
    try {
      if (!/^(library-file:|project-file:)/.test(ref) || !attachment.path || !attachment.sha256) throw Error('Missing native reference, local path or SHA256')
      if (sha256(await bytes(attachment.path)) !== attachment.sha256) throw Error('Attachment SHA256 mismatch')
    } catch (error) { issue('attachment-invalid', attachment.path, `${ref}: ${error.message}`) }
  }

  if (verify) for (const [id, row] of Object.entries(manifest.pages)) {
    if (row.kind !== 'note' || !ids.has(id)) continue
    const note = noteByPath.get(row.path), converted = convertedByPath.get(row.path), p = snapshots.get(id)
    try {
      if (!note?.sha256 || !converted || !p) throw Error('Inventory, converted-v3 row or full snapshot is absent')
      const local = await bytes(row.path), localHash = sha256(local)
      if (localHash !== note.sha256 || converted.source_sha256 !== note.sha256) throw Error('Original local note SHA256 changed since inventory/conversion')
      row.source_frontmatter_raw = local.toString('utf8').match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/)?.[0] ?? ''
      if (typeof converted.file !== 'string' || path.basename(converted.file) !== converted.file || !converted.file.endsWith('.md')) throw Error('Unsafe converted-v3 filename')
      const expected = (await bytes(`.knowledge/converted-v3/${converted.file}`)).toString('utf8')
      const expanded = p.content.blocks.filter(b => b.kind === 'markdown').map(b => {
        const refs = references(b.markdown)
        if (!refs.length) return b.markdown
        const ref = standalone(b.markdown), mapping = manifest.visualizations[ref]
        if (!mapping || mapping.embed_sha256 !== sha256(b.markdown)) throw Error('Unknown or changed visualization prevents body comparison')
        return mapping.markdown
      }).join('\n\n')
      if (!expanded.trim() && expected.trim()) throw Error('Empty live body cannot verify a nonempty source')
      for (const reference of rawWikiReferences(expanded)) issue('unconverted-wikilink', row.path, reference, id)
      if (p.content.blocks.some(b => b.kind === 'agent_instructions')) issue('unexpected-agent-instructions', row.path, null, id)
      const actualSignature = semanticSignature(expanded), expectedSignature = semanticSignature(expected)
      let comparison = actualSignature === expectedSignature ? 'semantic_ast' : pageWhitespaceSignature(expanded) === pageWhitespaceSignature(expected) ? 'page_whitespace_with_exact_code' : null
      const review = formatReviews.pages[id]
      if (!comparison && review) {
        const nonblank = value => value.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim()).map(line => line.trim()).join('\n')
        const validReview = ['native_indented_prose_blank_whitespace', 'math_region_native_boundaries'].includes(review.kind) && review.path === row.path && review.source_sha256 === localHash && review.expected_body_sha256 === sha256(expected) && review.actual_body_sha256 === sha256(expanded) && review.expected_structure_sha256 === sha256(expectedSignature) && review.actual_structure_sha256 === sha256(actualSignature) && typeof review.reason === 'string' && review.reason.trim()
        const sameReviewedFormat = review.kind === 'native_indented_prose_blank_whitespace' ? reviewedIndentedProseSignature(expanded) === reviewedIndentedProseSignature(expected) : reviewedMathBoundarySignature(expanded) === reviewedMathBoundarySignature(expected)
        if (validReview && nonblank(expanded) === nonblank(expected) && sameReviewedFormat) {
          comparison = review.kind === 'native_indented_prose_blank_whitespace' ? 'page_specific_reviewed_blank_prose' : 'page_specific_reviewed_math_boundaries'
          row.verification_format_review = clone(review)
        } else issue('page-format-review-mismatch', row.path, 'The exact reviewed bodies, source SHA256 or permitted whitespace transform no longer match', id)
      }
      if (!comparison) issue('converted-v3-semantic-difference', row.path, { expected_sha256: sha256(expectedSignature), actual_sha256: sha256(actualSignature) }, id)
      row.verification_comparison = comparison
      const rendered = await render(p, manifest, { row, id, path: row.path }, root)
      for (const detail of rendered.issues) issue('sync-render-issue', row.path, detail, id)
      if (!(noteIssues.get(id)?.length)) {
        row.migration_status = 'verified'
        row.baseline = { remote_sha256: remoteDigest(p, manifest), local_sha256: localHash, synced_at: new Date().toISOString() }
        if (rendered.regions.length) row.baseline.visualizations = Object.fromEntries(rendered.regions.map(r => [r.reference, { key: r.key, source_sha256: r.source_sha256, embed_sha256: r.embed_sha256, html_sha256: r.html_sha256 }]))
      }
    } catch (error) { issue('note-verification-failed', row.path, error.message, id) }
    row.verification_issues = noteIssues.get(id) ?? []
  }
  const notes = Object.values(manifest.pages).filter(p => p.kind === 'note')
  const report = { mode: verify ? 'verify-and-baseline' : 'register-pending', pages: Object.keys(manifest.pages).length, notes: notes.length, verified: notes.filter(p => p.migration_status === 'verified').length, pending: notes.filter(p => p.migration_status !== 'verified').length, reviewed_format_pages: notes.filter(p => p.migration_status === 'verified' && p.verification_comparison?.startsWith('page_specific_reviewed_')).map(p => p.path), attachments: Object.keys(manifest.attachments).length, active_math_regions: Object.keys(manifest.visualizations).length, threads: Object.keys(registry.threads).length, snapshots: snapshots.size, issues }
  return { manifest, registry, report, inputGuards, receiptNames }
}

async function unchanged(candidate, root) {
  for (const [file, expected] of candidate.inputGuards) {
    const current = await fs.readFile(file).then(sha256).catch(error => { if (error.code === 'ENOENT') return null; throw error })
    if (current !== expected) throw Error(`Input changed after candidate was prepared: ${path.relative(root, file)}`)
  }
  const names = (await fs.readdir(path.join(root, '.knowledge'))).filter(n => /^formula-receipts-.*\.jsonl$/.test(n)).sort()
  if (JSON.stringify(names) !== JSON.stringify(candidate.receiptNames)) throw Error('Receipt file inventory changed; rebuild candidate')
}

async function selfTest() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-finalize-'))
  try {
    const notePath = '002-学习笔记/test.md', source = '---\naliases: [Example]\n---\n# Topic\n\nValue $x$ with `code`.\n', paragraph = 'Value $x$ with `code`.', ref = 'visualize:fixture-file'
    await fs.mkdir(path.join(root, '.knowledge/exports'), { recursive: true }); await fs.mkdir(path.join(root, '.knowledge/converted-v3'), { recursive: true }); await fs.mkdir(path.join(root, '.knowledge/formula-regions'), { recursive: true }); await fs.mkdir(path.join(root, '002-学习笔记'), { recursive: true })
    await fs.writeFile(path.join(root, notePath), source)
    const state = { version: 1, pages: { [notePath]: { page_id: 'fixture-note', kind: 'note', title: 'Example', url: 'https://example.invalid/note', parent_page_id: 'fixture-parent' } }, controller: { threadId: 'fixture-controller', hostId: 'local' }, curator: { threadId: 'fixture-curator', hostId: 'local' }, experts: {} }
    const block = md => ({ id: sha256(md), kind: 'markdown', markdown: md, hash: sha256(md) })
    const p = { metadata: { page_id: 'fixture-note', parent: { page_id: 'fixture-parent' }, url: state.pages[notePath].url }, content: { schema_version: 1, page_id: 'fixture-note', title: 'Example', title_hash: sha256('Example'), blocks: [block('# Topic'), block(`![Formula](${ref})`)] } }
    await writeJSON(path.join(root, '.knowledge/state.json'), state)
    await writeJSON(path.join(root, '.knowledge/inventory.json'), { notes: [{ path: notePath, data: { aliases: ['Example'] }, sha256: sha256(source) }] })
    await writeJSON(path.join(root, '.knowledge/converted-v3-index.json'), [{ path: notePath, file: 'test.md', source_sha256: sha256(source) }])
    await writeJSON(path.join(root, '.knowledge/attachments.json'), {})
    await writeJSON(path.join(root, '.knowledge/exports/fixture-note.json'), p)
    await fs.writeFile(path.join(root, '.knowledge/converted-v3/test.md'), '# Topic\n\n' + paragraph)
    await fs.writeFile(path.join(root, '.knowledge/formula-regions/test.html'), '<div>Fixture</div>')
    await fs.writeFile(path.join(root, '.knowledge/formula-receipts-test.jsonl'), JSON.stringify({ path: notePath, page_id: 'fixture-note', key: 'fixture-key', source_markdown: paragraph, source_sha256: sha256(paragraph), markdown: `![Formula](${ref})`, file_reference: 'fixture-file', html_file: 'formula-regions/test.html' }) + '\n')
    let candidate = await buildCandidate(root, true)
    assert.equal(candidate.report.verified, 1); assert.equal(candidate.report.issues.length, 0)
    assert.equal(candidate.manifest.visualizations[ref].embed_sha256, sha256(p.content.blocks[1].markdown)); assert.ok(!('block_id' in candidate.manifest.visualizations[ref])); assert.ok(!('page_id' in candidate.manifest.visualizations[ref]))
    assert.equal(candidate.registry.pages['fixture-note'].source_thread, null)
    assert.equal(semanticSignature('a\n b'), semanticSignature('a b'))
    assert.notEqual(semanticSignature('```js\na  b\n```'), semanticSignature('```js\na b\n```'))
    assert.equal(semanticSignature('```math\nx+y\n```'), semanticSignature('$$\nx+y\n$$'))
    assert.equal(pageWhitespaceSignature('- Example\n\n```js\na  b\n```'), pageWhitespaceSignature('- Example\n    ```js\n    a  b\n    ```'))
    assert.notEqual(pageWhitespaceSignature('- Example\n\n```js\na  b\n```'), pageWhitespaceSignature('- Example\n    ```js\n    a b\n    ```'))
    assert.notEqual(pageWhitespaceSignature('- Parent\n  - Child'), pageWhitespaceSignature('- Parent\n- Child'))
    assert.notEqual(pageWhitespaceSignature('a  \nb'), pageWhitespaceSignature('a\nb'))
    assert.notEqual(pageWhitespaceSignature('> Example\n\n```js\na\n```'), pageWhitespaceSignature('> Example\n> ```js\n> a\n> ```'))
    assert.equal(reviewedIndentedProseSignature('    prose\n    \n    next\n    '), reviewedIndentedProseSignature('    prose\n\n    next'))
    assert.notEqual(reviewedIndentedProseSignature('```\na\n    \nb\n```'), reviewedIndentedProseSignature('```\na\n\nb\n```'))
    assert.notEqual(reviewedIndentedProseSignature('    a  b'), reviewedIndentedProseSignature('    a b'))
    assert.equal(reviewedMathBoundarySignature('Text\n5. Next\n\n```math\nx\n```'), reviewedMathBoundarySignature('Text\n\n5. Next\n\n```math\nx\n```'))
    assert.notEqual(reviewedMathBoundarySignature('> quoted\n\n5. Step'), reviewedMathBoundarySignature('quoted\n\n5. Step'))
    assert.notEqual(reviewedMathBoundarySignature('Text\n\n5. Step'), reviewedMathBoundarySignature('Text\n\n6. Step'))
    assert.notEqual(reviewedMathBoundarySignature('```js\na  b\n```'), reviewedMathBoundarySignature('```js\na b\n```'))
    assert.deepEqual(rawWikiReferences('![[Book [Part].pdf#page=2]] and `[[literal]]`\n\n```text\n![[code]]\n```'), ['![[Book [Part].pdf#page=2]]'])
    assert.deepEqual(rawWikiReferences('Tensor: [[1, 2], [3, 4]]; [[Real note]]'), ['[[Real note]]'])
    await assert.rejects(fs.access(path.join(root, '.knowledge/manifest.json')))
    const maintainedManifest = clone(candidate.manifest), maintainedRegistry = clone(candidate.registry)
    maintainedManifest.pages['fixture-note'].maintainer_expert = 'fixture-maintainer'
    maintainedRegistry.pages['fixture-note'].maintainer_expert = 'fixture-maintainer'
    maintainedRegistry.threads['fixture-maintainer'] = { threadId: 'fixture-maintainer', hostId: 'local', role: 'expert', title: 'Maintainer', revision: 0 }
    await writeJSON(path.join(root, '.knowledge/manifest.json'), maintainedManifest)
    await writeJSON(path.join(root, '.knowledge/threads.json'), maintainedRegistry)
    candidate = await buildCandidate(root, true)
    assert.equal(candidate.manifest.pages['fixture-note'].maintainer_expert, 'fixture-maintainer')
    assert.equal(candidate.registry.pages['fixture-note'].maintainer_expert, 'fixture-maintainer')
    const conflictingRegistry = clone(maintainedRegistry)
    conflictingRegistry.pages['fixture-note'].source_thread = 'fixture-source'
    await writeJSON(path.join(root, '.knowledge/threads.json'), conflictingRegistry)
    await assert.rejects(buildCandidate(root, true), /source_thread conflict/)
    await writeJSON(path.join(root, '.knowledge/threads.json'), maintainedRegistry)
    const conflictingManifest = clone(maintainedManifest)
    conflictingManifest.pages['fixture-note'].origin = 'expert'
    await writeJSON(path.join(root, '.knowledge/manifest.json'), conflictingManifest)
    await assert.rejects(buildCandidate(root, true), /origin conflict/)
    await writeJSON(path.join(root, '.knowledge/manifest.json'), maintainedManifest)
    const unchangedManifest = await fs.readFile(path.join(root, '.knowledge/manifest.json'), 'utf8')
    await fs.appendFile(path.join(root, notePath), '\nChanged')
    candidate = await buildCandidate(root, true); assert.equal(candidate.report.verified, 0); assert.equal(candidate.manifest.pages['fixture-note'].migration_status, 'pending'); assert.ok(!candidate.manifest.pages['fixture-note'].baseline)
    await fs.writeFile(path.join(root, notePath), source)
    await fs.writeFile(path.join(root, '.knowledge/converted-v3/test.md'), '# Topic\n\nChanged text')
    candidate = await buildCandidate(root, true); assert.equal(candidate.report.verified, 0); assert.ok(candidate.report.issues.some(i => i.code === 'converted-v3-semantic-difference'))
    await fs.writeFile(path.join(root, '.knowledge/formula-receipts-test.jsonl'), '')
    candidate = await buildCandidate(root, true); assert.equal(candidate.report.verified, 0); assert.equal(Object.keys(candidate.manifest.visualizations).length, 0); assert.ok(candidate.report.issues.some(i => i.code === 'visualization-unregistered'))
    assert.equal(await fs.readFile(path.join(root, '.knowledge/manifest.json'), 'utf8'), unchangedManifest)
    console.log('finalize self-test passed: guarded sources, strict code, semantic differences, existing maintainers, historical conflicts and no implicit writes')
  } finally { await fs.rm(root, { recursive: true, force: true }) }
}

async function main() {
  const a = args(process.argv.slice(2))
  for (const key of ['apply', 'dry-run', 'verify-and-baseline', 'self-test', 'json']) if (a[key] !== undefined && a[key] !== true) throw Error(`--${key} is a standalone flag`)
  if (a['self-test'] || a._[0] === 'self-test') return selfTest()
  if (a.apply && a['dry-run']) throw Error('Choose --apply or --dry-run')
  const root = path.resolve(a.root ?? vaultRoot), candidate = await buildCandidate(root, Boolean(a['verify-and-baseline']))
  if (a.apply) {
    const manifestFile = path.join(root, '.knowledge/manifest.json'), registryFile = path.join(root, '.knowledge/threads.json')
    await withLock(manifestFile, () => withLock(registryFile, async () => {
      await unchanged(candidate, root)
      await writeJSON(manifestFile, candidate.manifest)
      await writeJSON(registryFile, candidate.registry)
    }))
  }
  console.log(JSON.stringify(a.json ? { ...candidate.report, applied: Boolean(a.apply), manifest: candidate.manifest, registry: candidate.registry } : { ...candidate.report, applied: Boolean(a.apply) }, null, 2))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1 })
