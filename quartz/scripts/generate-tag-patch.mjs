#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { cacheRoot, quartzRoot, tagReportPath } from "./site-paths.mjs"
import { withSuggestedTags } from "./tag-normalize.mjs"

const report = JSON.parse(await readFile(tagReportPath, "utf8"))
const patches = []
for (const item of report.items.filter((item) => item.suggested.length)) {
  const file = path.resolve(quartzRoot, item.file)
  const relative = path.relative(quartzRoot, file)
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Unsafe report path: ${item.file}`)
  const original = await readFile(file, "utf8")
  const updated = withSuggestedTags(original, item.suggested)
  if (updated === original) continue
  const before = original.split("\n")
  const after = updated.split("\n")
  const oldHasNewline = before.at(-1) === ""
  const newHasNewline = after.at(-1) === ""
  if (oldHasNewline) before.pop()
  if (newHasNewline) after.pop()
  const filePath = `quartz/${item.file}`
  const lines = [
    `--- ${JSON.stringify(`a/${filePath}`)}`,
    `+++ ${JSON.stringify(`b/${filePath}`)}`,
    `@@ -${before.length ? 1 : 0},${before.length} +1,${after.length} @@`,
    ...before.map((line) => `-${line}`),
    ...(!oldHasNewline && before.length ? ["\\ No newline at end of file"] : []),
    ...after.map((line) => `+${line}`),
    ...(!newHasNewline ? ["\\ No newline at end of file"] : []),
  ]
  patches.push(lines.join("\n") + "\n")
}
const output = path.join(cacheRoot, "tag-apply.patch")
await writeFile(output, patches.join(""))
console.log(`Wrote ${patches.length} patches to ${output}; apply from the vault root.`)
