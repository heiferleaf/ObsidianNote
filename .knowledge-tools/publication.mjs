import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { args, vaultRoot, sha256, readJSON, writeJSON, withLock } from './registry.mjs'

const dataFiles = new Set(['state.json', 'manifest.json', 'threads.json', 'attachments.json', 'quartz-assets.json', 'quartz-result.json', 'page-format-equivalence.json', 'routing.md', 'workflow.md', 'math-fixes.json', 'migration-report.json', 'display-policy.json', 'catalog-view.json', 'catalog-policy.json', 'note-expert-index.csv'])
const bases = new Set(['user-requested learning notes', 'user-requested referenced attachments', 'user-requested Quartz repair', 'user-requested knowledge infrastructure'])
const git = (root, argv, input) => execFileSync('git', argv, { cwd: root, encoding: 'utf8', input, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()

function relativeName(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || path.posix.isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw Error(`Invalid repository-relative path: ${name}`)
  return name
}

async function safeFile(root, name, missing = false) {
  relativeName(name)
  const base = await fs.realpath(root), file = path.resolve(base, ...name.split('/'))
  let cursor = base
  for (const component of name.split('/')) {
    cursor = path.join(cursor, component)
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw Error(`Symbolic link is not an approved publication path: ${name}`) }
    catch (e) { if (e.code === 'ENOENT' && missing) return file; throw e }
  }
  return file
}

async function eligible(root, row) {
  const name = relativeName(row.path)
  if (name.startsWith('quartz/content/') || ['quartz/README.md', 'quartz/CODE_OF_CONDUCT.md'].includes(name)) return false
  if (name.startsWith('002-学习笔记/') && row.scope_authorization === 'user-requested learning notes') return name.endsWith('.md')
  if (name.startsWith('003-Attachments/') || name.startsWith('002-学习笔记/')) {
    const attachments = await readJSON(path.join(root, '.knowledge/attachments.json'), {})
    const quartzAssets = await readJSON(path.join(root, '.knowledge/quartz-assets.json'), {})
    const plan = await readJSON(path.join(root, '.knowledge/plan.json'), { assets: [] })
    const references = new Set([...Object.values(attachments).map(a => a.path), ...Object.keys(quartzAssets).map(p => p.split('#')[0]), ...Object.values(quartzAssets).map(a => a.path), ...(plan.assets ?? []).filter(a => a.users?.length).map(a => a.path)].filter(Boolean).map(p => p.replaceAll('\\', '/')))
    const mappedHashes = [...Object.values(attachments), ...Object.values(quartzAssets)].filter(a => a.path?.replaceAll('\\', '/') === name && a.sha256).map(a => a.sha256)
    if (mappedHashes.some(hash => hash !== row.sha256)) throw Error(`Attachment mapping SHA256 differs: ${name}`)
    return row.scope_authorization === 'user-requested referenced attachments' && references.has(name)
  }
  if (name.startsWith('quartz/') || name.startsWith('.github/')) {
    const receipt = await readJSON(path.join(root, '.knowledge/quartz-result.json'), { changes: [] })
    return row.scope_authorization === 'user-requested Quartz repair' && receipt.changes.some(c => c.files?.includes(name))
  }
  const infrastructure = name === 'AGENTS.md' || name === '.gitignore' || /^\.codex\/docs\/[^\0]+\.md$/.test(name) || /^\.codex\/skills\/knowledge-(controller|curator)\//.test(name) || /^\.knowledge-tools\/[^/]+\.(mjs|py|html)$/.test(name) || (name.startsWith('.knowledge/') && dataFiles.has(name.slice('.knowledge/'.length)))
  return infrastructure && row.scope_authorization === 'user-requested knowledge infrastructure'
}

function checkLedger(ledger) {
  if (ledger.version !== 1 || !Array.isArray(ledger.entries)) throw Error('Expected publication ledger v1 with entries array')
  const paths = new Set()
  for (const row of ledger.entries) {
    relativeName(row.path)
    if (paths.has(row.path)) throw Error(`Duplicate publication path: ${row.path}`)
    paths.add(row.path)
  }
}

async function approvedRow(root, row) {
  if (!bases.has(row.scope_authorization) || !await eligible(root, row)) throw Error(`Path is outside its authorized publication scope: ${row.path}`)
  if (row.review_status !== 'approved' || row.reviewed_diff !== true || typeof row.evidence !== 'string' || !row.evidence.trim()) throw Error(`Explicit diff review and evidence required: ${row.path}`)
  if (typeof row.ownership !== 'string' || !row.ownership.trim()) throw Error(`Ownership must be recorded separately from publication scope: ${row.path}`)
  if (!/^[a-f0-9]{64}$/.test(row.sha256 ?? '')) throw Error(`Exact SHA256 required: ${row.path}`)
  const bytes = await fs.readFile(await safeFile(root, row.path))
  if (sha256(bytes) !== row.sha256) throw Error(`SHA256 drift: ${row.path}`)
  return bytes
}

// Optional review input adds only individually reviewed exact paths; it never infers ownership from git status.
export async function prepare(root, ledgerFile, options = {}) {
  if (options.review) await withLock(ledgerFile, async () => {
    const raw = await fs.readFile(ledgerFile), ledger = JSON.parse(raw)
    checkLedger(ledger)
    if (options.expectedLedger !== sha256(raw)) throw Error('Publication ledger changed; reread before merging reviewed entries')
    const review = await readJSON(options.review)
    if (review.version !== 1 || !Array.isArray(review.entries) || !review.entries.length) throw Error('Review input needs nonempty entries')
    const seen = new Set()
    for (const row of review.entries) {
      if (seen.has(row.path)) throw Error(`Duplicate reviewed path: ${row.path}`)
      seen.add(row.path)
      await approvedRow(root, row)
    }
    for (const row of review.entries) {
      const index = ledger.entries.findIndex(e => e.path === row.path), old = index < 0 ? {} : ledger.entries[index]
      const next = { ...old, ...row, publication_status: 'pending', reviewed_at: new Date().toISOString() }
      if (index < 0) ledger.entries.push(next); else ledger.entries[index] = next
    }
    ledger.updated_at = new Date().toISOString()
    await writeJSON(ledgerFile, ledger)
  })
  const raw = await fs.readFile(ledgerFile), ledger = JSON.parse(raw)
  checkLedger(ledger)
  const ready = [], blocked = []
  for (const row of ledger.entries) {
    if (row.publication_status === 'published') continue
    try {
      await approvedRow(root, row)
      ready.push({ path: row.path, sha256: row.sha256, git_blob_oid: git(root, ['hash-object', `--path=${row.path}`, row.path]), scope_authorization: row.scope_authorization })
    } catch (e) { blocked.push({ path: row.path, review_status: row.review_status, reason: e.message }) }
  }
  const ledgerPath = '.knowledge/publication.json'
  return { version: 1, prepared_at: new Date().toISOString(), ledger_sha256: sha256(raw), control_files: [{ path: ledgerPath, sha256: sha256(raw), git_blob_oid: git(root, ['hash-object', `--path=${ledgerPath}`, ledgerPath]) }], ready, blocked }
}

// The caller performs its authorized git-workflow separately. Ack only verifies and records an already-pushed commit.
export async function ack(root, ledgerFile, request, commit, remote = 'origin', branch) {
  if (!/^[a-f0-9]{40,64}$/.test(commit ?? '')) throw Error('Ack needs an exact observed commit hash')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote)) throw Error('Ack requires a configured remote name')
  branch ??= git(root, ['branch', '--show-current'])
  if (!branch) throw Error('Detached branch; specify the actual pushed branch')
  git(root, ['check-ref-format', `refs/heads/${branch}`])
  if (request.version !== 1 || !Array.isArray(request.ready) || !request.ready.length) throw Error('Ack needs a nonempty prepare request')
  return withLock(ledgerFile, async () => {
    const raw = await fs.readFile(ledgerFile), ledger = JSON.parse(raw)
    checkLedger(ledger)
    if (sha256(raw) !== request.ledger_sha256) throw Error('Publication ledger changed after prepare')
    if (!Array.isArray(request.control_files) || request.control_files.length !== 1 || request.control_files[0].path !== '.knowledge/publication.json' || request.control_files[0].sha256 !== request.ledger_sha256) throw Error('Prepare request lacks its exact publication ledger snapshot')
    const ledgerBlob = git(root, ['hash-object', '--path=.knowledge/publication.json', '.knowledge/publication.json'])
    if (request.control_files[0].git_blob_oid !== ledgerBlob || git(root, ['rev-parse', `${commit}:.knowledge/publication.json`]) !== ledgerBlob) throw Error('Commit does not include the prepared publication ledger snapshot')
    const seen = new Set()
    for (const item of request.ready) {
      if (seen.has(item.path)) throw Error(`Duplicate request path: ${item.path}`)
      seen.add(item.path)
      const row = ledger.entries.find(e => e.path === item.path)
      if (!row || row.publication_status === 'published' || row.sha256 !== item.sha256 || row.scope_authorization !== item.scope_authorization) throw Error(`Request no longer matches pending approved entry: ${item.path}`)
      await approvedRow(root, row)
      const currentBlob = git(root, ['hash-object', `--path=${item.path}`, item.path])
      if (item.git_blob_oid !== currentBlob || git(root, ['rev-parse', `${commit}:${item.path}`]) !== currentBlob) throw Error(`Committed bytes differ from prepared file: ${item.path}`)
    }
    const remoteLine = git(root, ['ls-remote', '--exit-code', remote, `refs/heads/${branch}`])
    const remoteCommit = remoteLine.split(/\s+/)[0]
    if (!/^[a-f0-9]{40,64}$/.test(remoteCommit)) throw Error('Remote branch did not return a commit')
    if (remoteCommit !== commit) {
      try { git(root, ['merge-base', '--is-ancestor', commit, remoteCommit]) }
      catch { throw Error('Remote branch does not contain the acknowledged commit; retain pending entries') }
    }
    const now = new Date().toISOString()
    for (const row of ledger.entries) if (seen.has(row.path)) Object.assign(row, { publication_status: 'published', published_commit: commit, published_remote: remote, published_branch: branch, published_at: now })
    ledger.updated_at = now
    await writeJSON(ledgerFile, ledger)
    return { acknowledged: seen.size, commit, remote, branch, still_pending: ledger.entries.filter(e => e.publication_status !== 'published').length }
  })
}

async function selfTest() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-publication-'))
  try {
    git(root, ['init', '--quiet', '-b', 'main'])
    const p = '.knowledge-tools/tool.mjs', ledgerFile = path.join(root, '.knowledge/publication.json')
    await fs.mkdir(path.join(root, '.knowledge-tools')); await fs.writeFile(path.join(root, p), 'export const x = 1\n')
    const row = { path: p, sha256: sha256(await fs.readFile(path.join(root, p))), scope_authorization: 'user-requested knowledge infrastructure', ownership: 'fixture', evidence: 'isolated reviewed fixture', reviewed_diff: true, review_status: 'approved', publication_status: 'pending' }
    await writeJSON(ledgerFile, { version: 1, entries: [row, { ...row, path: 'quartz/content/keep.md', review_status: 'requires-review' }] })
    let request = await prepare(root, ledgerFile)
    assert.equal(request.ready.length, 1); assert.equal(request.blocked.length, 1)
    await fs.appendFile(path.join(root, p), '// drift\n')
    assert.equal((await prepare(root, ledgerFile)).ready.length, 0)
    await fs.writeFile(path.join(root, p), 'export const x = 1\n')
    await assert.rejects(safeFile(root, '../outside'), /Invalid/)
    await assert.rejects(approvedRow(root, { ...row, path: '003-Attachments/unreferenced.png', scope_authorization: 'user-requested referenced attachments' }), /outside/)
    await fs.mkdir(path.join(root, '003-Attachments'))
    await fs.writeFile(path.join(root, '003-Attachments/drawing.excalidraw.md'), 'drawing source')
    await writeJSON(path.join(root, '.knowledge/quartz-assets.json'), { '003-Attachments/drawing.excalidraw.md#group=observed': { path: '003-Attachments/generated.png' } })
    await approvedRow(root, { ...row, path: '003-Attachments/drawing.excalidraw.md', sha256: sha256('drawing source'), scope_authorization: 'user-requested referenced attachments' })
    await writeJSON(path.join(root, '.knowledge/quartz-assets.json'), { '003-Attachments/drawing.excalidraw.md#group=observed': { path: '003-Attachments/drawing.excalidraw.md', sha256: 'wrong' } })
    await assert.rejects(approvedRow(root, { ...row, path: '003-Attachments/drawing.excalidraw.md', sha256: sha256('drawing source'), scope_authorization: 'user-requested referenced attachments' }), /mapping SHA256/)
    await fs.mkdir(path.join(root, 'quartz')); await fs.writeFile(path.join(root, 'quartz/repair.mjs'), '// repair')
    await writeJSON(path.join(root, '.knowledge/quartz-result.json'), { changes: [{ files: ['quartz/repair.mjs'] }] })
    await approvedRow(root, { ...row, path: 'quartz/repair.mjs', sha256: sha256('// repair'), scope_authorization: 'user-requested Quartz repair' })
    const reviewFile = path.join(root, 'review.json')
    await writeJSON(reviewFile, { version: 1, entries: [row] })
    await assert.rejects(prepare(root, ledgerFile, { review: reviewFile, expectedLedger: 'stale' }), /ledger changed/)
    const blob = git(root, ['hash-object', '-w', '--stdin'], 'export const x = 1\n')
    const toolsTree = git(root, ['mktree'], `100644 blob ${blob}\ttool.mjs\n`)
    const ledgerBlob = git(root, ['hash-object', '-w', '--stdin'], await fs.readFile(ledgerFile))
    const ledgerTree = git(root, ['mktree'], `100644 blob ${ledgerBlob}\tpublication.json\n`)
    const tree = git(root, ['mktree'], `040000 tree ${ledgerTree}\t.knowledge\n040000 tree ${toolsTree}\t.knowledge-tools\n`)
    const commit = git(root, ['-c', 'user.name=Publication Test', '-c', 'user.email=fixture@example.invalid', 'commit-tree', tree, '-m', 'isolated fixture'])
    git(root, ['update-ref', 'refs/heads/main', commit]); git(root, ['remote', 'add', 'origin', root])
    request = await prepare(root, ledgerFile)
    const before = await fs.readFile(ledgerFile, 'utf8')
    await assert.rejects(ack(root, ledgerFile, { ...request, ledger_sha256: 'stale' }, commit), /ledger changed/)
    await assert.rejects(ack(root, ledgerFile, { ...request, ready: [{ ...request.ready[0], git_blob_oid: 'wrong' }] }, commit), /Committed bytes/)
    await assert.rejects(ack(root, ledgerFile, request, commit, 'origin', 'not-pushed'))
    assert.equal(await fs.readFile(ledgerFile, 'utf8'), before)
    assert.equal((await ack(root, ledgerFile, request, commit)).acknowledged, 1)
    assert.equal((await readJSON(ledgerFile)).entries[0].publication_status, 'published')
    console.log('publication self-test passed: scope, unreferenced assets, SHA drift, ledger guards, committed bytes, verified remote acknowledgement; no stage/commit/push commands')
  } finally { await fs.rm(root, { recursive: true, force: true }) }
}

async function main() {
  const a = args(process.argv.slice(2)), command = a._[0] ?? 'help'
  if (command === 'help') return console.log('publication.mjs prepare [--review reviewed.json --expected-ledger SHA256] [--output .knowledge/requests/publication.json]\npublication.mjs ack --request prepare.json --commit OBSERVED_HASH [--remote origin --branch main]\nBoth accept --root and --ledger. No automatic stage, commit, push, or deployment. self-test uses an isolated temporary repository.')
  if (command === 'self-test') return selfTest()
  const root = path.resolve(a.root ?? vaultRoot), ledgerFile = path.resolve(a.ledger ?? path.join(root, '.knowledge/publication.json'))
  const ledgerRelative = path.relative(root, ledgerFile).replaceAll('\\', '/')
  if (ledgerRelative !== '.knowledge/publication.json') throw Error('Ledger must be .knowledge/publication.json within the selected root')
  await safeFile(root, ledgerRelative, true)
  let result
  if (command === 'prepare') result = await prepare(root, ledgerFile, { review: a.review && path.resolve(a.review), expectedLedger: a['expected-ledger'] })
  else if (command === 'ack') result = await ack(root, ledgerFile, await readJSON(path.resolve(a.request)), a.commit, a.remote ?? 'origin', a.branch)
  else throw Error(`Unknown publication command: ${command}`)
  if (a.output) {
    const output = path.resolve(a.output), relative = path.relative(root, output).replaceAll('\\', '/')
    if (!relative.startsWith('.knowledge/requests/') || !relative.endsWith('.json')) throw Error('Output must be a .knowledge/requests/*.json file')
    await safeFile(root, relative, true); await writeJSON(output, result)
  }
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1 })
