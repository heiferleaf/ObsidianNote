#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { quartzRoot, tagReportPath } from "./site-paths.mjs"
import { withSuggestedTags } from "./tag-normalize.mjs"

const args = process.argv.slice(2)
const sampleIndex = args.indexOf("--sample")
const count = sampleIndex < 0 ? 5 : Number(args[sampleIndex + 1])
if (!Number.isSafeInteger(count) || count < 1)
  throw new Error("--sample must be a positive integer")
const report = JSON.parse(await readFile(tagReportPath, "utf8"))
for (const item of report.items.filter((item) => item.suggested.length).slice(0, count)) {
  const file = path.resolve(quartzRoot, item.file)
  const relative = path.relative(quartzRoot, file)
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Unsafe report path: ${item.file}`)
  const original = await readFile(file, "utf8")
  const updated = withSuggestedTags(original, item.suggested)
  console.log(
    `${item.file}: ${JSON.stringify(item.suggested)} (${updated === original ? "unchanged" : "missing tags"})`,
  )
  if (args.includes("--apply") && updated !== original) await writeFile(file, updated)
}
