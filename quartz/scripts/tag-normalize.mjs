#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, utimes, writeFile } from "node:fs/promises"
import path from "node:path"
import yaml from "js-yaml"
import { isMain, quartzRoot, tagReportPath } from "./site-paths.mjs"

export async function walkMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walkMarkdownFiles(fullPath)))
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath)
  }
  return files
}

export function slugify(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

export function extractFrontmatter(text) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(text)
  if (!match || match.index !== 0) return null
  return {
    raw: match[1],
    end: match[0].length,
    closing: match[0].lastIndexOf("---"),
    data: yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) ?? {},
  }
}

export function suggestTags(relativePath, text, frontmatter) {
  const parts = relativePath.split(/[\\/]/)
  const candidates = parts.slice(0, -1).filter((part) => part !== "002-学习笔记")
  const title =
    frontmatter?.data.title ?? text.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(relativePath, ".md")
  candidates.push(
    ...String(title)
      .split(/[\p{P}\p{S}\s]+/u)
      .filter((word) => word.length >= 2)
      .slice(0, 3),
  )
  return [...new Set(candidates.map((value) => slugify(value.replace(/^\d+[-_.\s]+/, ""))))]
    .filter((value) => value.length >= 2 && !/^\d+$/.test(value) && value !== "笔记")
    .slice(0, 6)
}

// Insert only the missing tags field; preserve other YAML lists and the body verbatim.
export function withSuggestedTags(text, tags) {
  const frontmatter = extractFrontmatter(text)
  if (
    frontmatter &&
    (Object.hasOwn(frontmatter.data, "tags") || Object.hasOwn(frontmatter.data, "tag"))
  )
    return text
  if (tags.length === 0) return text
  const newline = text.includes("\r\n") ? "\r\n" : "\n"
  const block = `tags:${newline}${tags.map((tag) => `  - ${JSON.stringify(tag)}`).join(newline)}${newline}`
  if (!frontmatter) {
    const bom = text.startsWith("\uFEFF") ? "\uFEFF" : ""
    return `${bom}---${newline}${block}---${newline}${text.slice(bom.length)}`
  }
  return text.slice(0, frontmatter.closing) + block + text.slice(frontmatter.closing)
}

export async function normalizeTags({
  contentRoot = path.join(quartzRoot, "content"),
  apply = false,
  reportPath = tagReportPath,
} = {}) {
  const files = await walkMarkdownFiles(contentRoot)
  const items = []
  for (const file of files) {
    const relativePath = path.relative(contentRoot, file)
    if (
      relativePath === "index.md" ||
      relativePath.startsWith("003-Attachments") ||
      relativePath.endsWith(".excalidraw.md")
    )
      continue
    const text = await readFile(file, "utf8")
    const frontmatter = extractFrontmatter(text)
    if (
      frontmatter &&
      (Object.hasOwn(frontmatter.data, "tags") || Object.hasOwn(frontmatter.data, "tag"))
    )
      continue
    const suggested = suggestTags(relativePath, text, frontmatter)
    items.push({ file: path.relative(quartzRoot, file).split(path.sep).join("/"), suggested })
    const updated = withSuggestedTags(text, suggested)
    if (apply && updated !== text) {
      const originalStat = await stat(file)
      await writeFile(file, updated)
      await utimes(file, originalStat.atime, originalStat.mtime)
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    contentRoot,
    processed: files.length,
    items,
  }
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(
    `tag-normalize: processed ${files.length} files, missing-tags: ${items.length}, apply=${apply}`,
  )
  return report
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2)
  const directoryIndex = args.indexOf("--directory")
  normalizeTags({
    contentRoot: directoryIndex < 0 ? undefined : path.resolve(args[directoryIndex + 1]),
    apply: args.includes("--apply") || args.includes("-a"),
  }).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
