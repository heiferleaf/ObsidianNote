import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

export const vaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
export async function readJSON(file, fallback) {
  try { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')) }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback); throw error }
}
export async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  try { await fs.writeFile(temp, data, { flag: 'wx' }); await fs.rename(temp, file) }
  finally { await fs.rm(temp, { force: true }) }
}
export const writeJSON = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + '\n')

// Serialize read-modify-write across independent chats/processes. Never steal an old lock.
export async function withLock(file, action, timeout = 5000) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const lock = `${file}.lock`, token = crypto.randomUUID(), started = Date.now()
  for (;;) {
    try {
      const handle = await fs.open(lock, 'wx')
      try { await handle.writeFile(JSON.stringify({ token, pid: process.pid, created_at: new Date().toISOString() })) }
      finally { await handle.close() }
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (Date.now() - started >= timeout) throw new Error(`Lock busy: ${lock}. Inspect its owner before removing it.`)
      await new Promise(resolve => setTimeout(resolve, 40))
    }
  }
  try { return await action() }
  finally {
    const owner = await readJSON(lock, {})
    if (owner.token === token) await fs.rm(lock)
  }
}

export function args(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { result._.push(argv[i]); continue }
    const key = argv[i].slice(2)
    if (!key || key.includes('=')) throw new Error('Use --option value, not --option=value')
    result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  }
  return result
}
function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') {
    const out = Object.create(null)
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Unsafe key: ${key}`)
      out[key] = clean(item)
    }
    return out
  }
  return value
}
function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a nonempty string`)
}
function requireIdentifier(value, field) {
  requireString(value, field)
  if (['__proto__', 'prototype', 'constructor'].includes(value)) throw new Error(`Unsafe ${field}`)
}
function checkRegistry(value) {
  if (value.version !== 1 || !value.threads || !value.pages || Array.isArray(value.threads) || Array.isArray(value.pages)) {
    throw new Error('Expected registry v1: {version:1, threads:{threadId:record}, pages:{page_id:record}}. Do not overwrite another schema.')
  }
}

export async function register(file, input, expectedRevision) {
  const patch = clean(input)
  requireIdentifier(patch.threadId, 'threadId')
  if (patch.role === 'curator') { patch.role = 'worker'; patch.specialty ??= 'curator' }
  if (patch.role === 'controller') patch.role = 'router'
  if (patch.role === 'expert') patch.role = 'worker'
  if (patch.role && !['router', 'worker'].includes(patch.role)) throw new Error('role must be router or worker')
  for (const key of ['aliases', 'topics']) if (patch[key] && (!Array.isArray(patch[key]) || patch[key].some(v => typeof v !== 'string'))) throw new Error(`${key} must be strings`)
  if (patch.lifecycle !== undefined && !['active', 'archived', 'missing', 'unknown'].includes(patch.lifecycle)) throw new Error('Unsupported thread lifecycle')
  return withLock(file, async () => {
    const db = await readJSON(file, { version: 1, threads: {}, pages: {} })
    checkRegistry(db)
    const old = db.threads[patch.threadId] ?? {}
    if (!old.threadId) { requireString(patch.title, 'title'); requireString(patch.role, 'role') }
    if (['router', 'worker'].includes(old.role) && patch.role && patch.role !== old.role) throw new Error('Role change is outside routine chat metadata updates')
    if (expectedRevision !== undefined && Number(expectedRevision) !== (old.revision ?? 0)) throw new Error('Registry revision conflict; reread the record')
    const row = { ...old, ...patch, revision: (old.revision ?? 0) + 1, updated_at: new Date().toISOString() }
    for (const key of ['aliases', 'topics']) if (patch[key]) row[key] = [...new Set([...(old[key] ?? []), ...patch[key]])]
    db.threads[patch.threadId] = row
    await writeJSON(file, db)
    return row
  })
}

export async function linkPage(file, input, expectedRevision) {
  const patch = clean(input)
  requireIdentifier(patch.page_id, 'page_id')
  if (patch.source_thread !== null && patch.source_thread !== undefined) requireString(patch.source_thread, 'source_thread')
  for (const key of ['aliases', 'keywords', 'contributor_experts']) if (patch[key] !== undefined && (!Array.isArray(patch[key]) || patch[key].some(v => typeof v !== 'string' || !v.trim()))) throw new Error(`${key} must be nonempty strings`)
  for (const key of ['summary', 'assignment_reason', 'note_type']) if (patch[key] !== undefined && patch[key] !== null && typeof patch[key] !== 'string') throw new Error(`${key} must be a string or null`)
  if (patch.review_status !== undefined && !['unverified', 'confirmed', 'needs_review'].includes(patch.review_status)) throw new Error('Unsupported association review status')
  if (patch.verification !== undefined) {
    if (!patch.verification || typeof patch.verification !== 'object' || !Number.isFinite(Date.parse(patch.verification.checked_at))) throw new Error('verification requires an observed checked_at')
    if (!['confirmed', 'unassigned', 'needs_review'].includes(patch.verification.status)) throw new Error('Unsupported verification status')
    if (!patch.verification.evidence?.trim()) throw new Error('verification requires live evidence description')
  }
  if (patch.association_history !== undefined) throw new Error('Association history is maintained by registry.mjs')
  return withLock(file, async () => {
    const db = await readJSON(file, { version: 1, threads: {}, pages: {} })
    checkRegistry(db)
    const old = db.pages[patch.page_id] ?? {}
    const policy = await readJSON(path.join(path.dirname(file), 'catalog-policy.json'), {})
    if (policy.scope === 'new-notes-only') {
      if (policy.excluded_existing_page_ids?.includes(patch.page_id)) throw new Error('Existing note is excluded from the new-note catalog; do not backfill it')
      patch.catalog_managed = true
    }
    if (expectedRevision !== undefined && Number(expectedRevision) !== (old.revision ?? 0)) throw new Error('Registry revision conflict; reread the record')
    if ((old.origin === 'imported' || patch.origin === 'imported') && (patch.source_thread ?? old.source_thread) != null) throw new Error('Imported notes have source_thread:null; associate a maintainer separately')
    if (old.origin === 'imported' && patch.origin && patch.origin !== 'imported') throw new Error('Historical origin cannot be relabeled')
    const row = { ...old, ...patch, revision: (old.revision ?? 0) + 1, updated_at: new Date().toISOString() }
    if (row.origin === 'imported') row.source_thread = null
    for (const field of ['source_thread', 'maintainer_expert']) {
      if (row[field] != null && !db.threads[row[field]]) throw new Error(`${field} thread is not registered: ${row[field]}`)
    }
    const isWorker = id => ['worker', 'expert'].includes(db.threads[id]?.role)
    if (row.maintainer_expert && !isWorker(row.maintainer_expert)) throw new Error('maintainer_expert must have role worker')
    if (row.source_thread && !isWorker(row.source_thread)) throw new Error('source_thread must have role worker')
    for (const id of row.contributor_experts ?? []) if (!isWorker(id)) throw new Error(`contributor_experts must reference registered Workers: ${id}`)
    if (patch.verification && (patch.verification.maintainer_expert ?? null) !== (row.maintainer_expert ?? null)) throw new Error('Verification targets a different maintainer')
    const changed = ['source_thread', 'maintainer_expert', 'contributor_experts'].some(key => JSON.stringify(old[key] ?? (key === 'contributor_experts' ? [] : null)) !== JSON.stringify(row[key] ?? (key === 'contributor_experts' ? [] : null)))
    row.association_history = old.association_history ?? []
    if (changed) {
      const pick = value => Object.fromEntries(['source_thread', 'maintainer_expert', 'contributor_experts'].map(key => [key, value[key] ?? (key === 'contributor_experts' ? [] : null)]))
      row.association_history = [...row.association_history, { at: row.updated_at, before: pick(old), after: pick(row), reason: patch.assignment_reason ?? null }]
      if (!patch.verification) { row.review_status = 'unverified'; delete row.verification }
    }
    db.pages[patch.page_id] = row
    await writeJSON(file, db)
    return row
  })
}

export function resolve(db, query) {
  checkRegistry(db)
  const needle = query.trim().toLocaleLowerCase()
  const exact = Object.values(db.threads).filter(t => [t.threadId, t.title, ...(t.aliases ?? [])].some(v => v?.toLocaleLowerCase() === needle))
  if (exact.length) return exact
  return Object.values(db.threads).filter(t => [t.title, ...(t.aliases ?? []), ...(t.topics ?? [])].some(v => v?.toLocaleLowerCase().includes(needle)))
}

async function selfTest() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-registry-'))
  try {
    const file = path.join(temp, 'threads.json')
    await Promise.all(Array.from({ length: 16 }, (_, i) => register(file, { threadId: `expert-${i}`, role: 'expert', title: `Expert ${i}` })))
    assert.equal(Object.keys((await readJSON(file)).threads).length, 16)
    await Promise.all([register(file, { threadId: 'expert-0', aliases: ['Expert Java'] }), register(file, { threadId: 'expert-0', topics: ['JVM'] })])
    let db = await readJSON(file)
    assert.deepEqual(db.threads['expert-0'].aliases, ['Expert Java'])
    assert.deepEqual(db.threads['expert-0'].topics, ['JVM'])
    assert.equal(resolve(db, 'Expert Java')[0].threadId, 'expert-0')
    await register(file, { threadId: 'expert-0', role_ref: '.codex/docs/roles/java.md' })
    await register(file, { threadId: 'expert-0', role_ref: '.codex/docs/roles/jvm.md' })
    db = await readJSON(file)
    assert.equal(db.threads['expert-0'].role_ref, '.codex/docs/roles/jvm.md')
    assert.deepEqual(db.threads['expert-0'].topics, ['JVM'])
    await assert.rejects(register(file, { threadId: 'expert-0', role: 'router' }), /Role change/)
    await linkPage(file, { page_id: 'page-imported', origin: 'imported', maintainer_expert: 'expert-0' })
    assert.equal((await readJSON(file)).pages['page-imported'].source_thread, null)
    await linkPage(file, { page_id: 'page-imported', maintainer_expert: 'expert-1', assignment_reason: 'Reassigned after explicit review' }, 1)
    let linked = (await readJSON(file)).pages['page-imported']
    assert.equal(linked.association_history.length, 2)
    assert.equal(linked.association_history[1].before.maintainer_expert, 'expert-0')
    await linkPage(file, { page_id: 'page-imported', keywords: ['JVM'], summary: 'Reviewed note' }, 2)
    linked = (await readJSON(file)).pages['page-imported']
    assert.equal(linked.maintainer_expert, 'expert-1'); assert.equal(linked.association_history.length, 2)
    await assert.rejects(linkPage(file, { page_id: 'page-imported', verification: { checked_at: new Date().toISOString(), status: 'confirmed', maintainer_expert: 'expert-0', evidence: 'fixture' } }), /different maintainer/)
    await assert.rejects(linkPage(file, { page_id: 'page-imported', contributor_experts: ['missing'] }), /registered Workers/)
    await assert.rejects(linkPage(file, { page_id: 'page-imported', source_thread: 'expert-0' }), /Imported/)
    await assert.rejects(register(file, { threadId: 'expert-0', title: 'overwrite' }, 0), /revision conflict/)
    await assert.rejects(linkPage(file, { page_id: 'page-x', maintainer_expert: 'missing' }), /not registered/)
    await writeJSON(path.join(temp, 'catalog-policy.json'), { version: 1, scope: 'new-notes-only', excluded_existing_page_ids: ['page-imported'] })
    await assert.rejects(linkPage(file, { page_id: 'page-imported', keywords: ['do not backfill'] }), /excluded/)
    const fresh = await linkPage(file, { page_id: 'page-new', origin: 'template', source_thread: null, maintainer_expert: 'expert-1' })
    assert.equal(fresh.catalog_managed, true)
    await assert.rejects(register(file, JSON.parse('{"threadId":"bad","__proto__":{}}')), /Unsafe/)
    await assert.rejects(register(file, { threadId: '__proto__' }), /Unsafe/)
    await fs.writeFile(`${file}.lock`, '{"token":"other"}')
    await assert.rejects(withLock(file, async () => {}, 50), /Lock busy/)
    console.log('registry self-test: 16 concurrent registrations, association history, maintainer preservation, review guards, provenance, revisions, alias lookup, unsafe input and lock contention passed')
  } finally {
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()))
    await fs.rm(temp, { recursive: true, force: true })
  }
}

async function main() {
  const a = args(process.argv.slice(2)), command = a._[0] ?? 'help'
  if (command === 'self-test') return selfTest()
  const file = path.resolve(a.file ?? path.join(vaultRoot, '.knowledge/threads.json'))
  if (command === 'help') return console.log('registry.mjs show | resolve QUERY | register --input record.json | link-page --input link.json | self-test\nOptions: --file path, --expected-revision N. Mutations lock and merge the latest registry; incompatible schemas stop.')
  if (command === 'show') return console.log(JSON.stringify(await readJSON(file), null, 2))
  if (command === 'resolve') {
    if (!a._[1]) throw new Error('resolve requires a title, alias, or topic')
    return console.log(JSON.stringify(resolve(await readJSON(file), a._.slice(1).join(' ')), null, 2))
  }
  if (!a.input) throw new Error('--input JSON file is required')
  const input = await readJSON(path.resolve(a.input))
  if (command === 'register') return console.log(JSON.stringify(await register(file, input, a['expected-revision']), null, 2))
  if (command === 'link-page') return console.log(JSON.stringify(await linkPage(file, input, a['expected-revision']), null, 2))
  throw new Error(`Unknown command: ${command}`)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
