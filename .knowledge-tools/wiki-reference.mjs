import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A bare numeric matrix is Python/JSON data, while ![[...]] is always an embed.
export function isNumericMatrixWiki(markdown) {
  let value
  try { value = JSON.parse(markdown) } catch { return false }
  return Array.isArray(value) && value.length >= 2 && Array.isArray(value[0]) && value[0].length >= 2 && value.every(row => Array.isArray(row) && row.length === value[0].length && row.every(cell => typeof cell === 'number'))
}

export function wikiReferences(markdown, protectedRanges = []) {
  return [...markdown.matchAll(/(!?)\[\[([^\r\n\uE000\uE001]+?)\]\]/g)].filter(match =>
    !protectedRanges.some(range => match.index < range.to && match.index + match[0].length > range.from) &&
    (match[1] || !isNumericMatrixWiki(match[0])))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'self-test') throw Error('Use wiki-reference.mjs self-test')
  assert.equal(wikiReferences('tensor = [[1, 2], [3, 4]]').length, 0)
  assert.equal(wikiReferences('[[1, 2, 3], [4, 5, 6], [7, 8, 9]]').length, 0)
  assert.equal(wikiReferences('![[1, 2], [3, 4]]').length, 1)
  assert.equal(wikiReferences('[[2026]]')[0][2], '2026')
  assert.equal(wikiReferences('[[2026.md]]')[0][2], '2026.md')
  assert.equal(wikiReferences('[[1, 2], [3]]').length, 1)
  assert.equal(wikiReferences('[![not a wiki]]').length, 0)
  assert.equal(wikiReferences('![[[沙特]算法.pdf#page=64]]')[0][2], '[沙特]算法.pdf#page=64')
  assert.equal(wikiReferences('[[file\nname]]').length, 0)
  assert.equal(wikiReferences('[[file\uE0001\uE001name]]').length, 0)
  assert.equal(wikiReferences('[[file code name]]', [{ from: 7, to: 11 }]).length, 0)
  console.log('wiki-reference self-test passed: bare numeric matrices, real year/file links, bracket titles, line and code boundaries')
}
