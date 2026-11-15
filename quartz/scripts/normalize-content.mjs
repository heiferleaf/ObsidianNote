import { readFile, readdir, stat, utimes, writeFile } from "node:fs/promises"
import path from "node:path"
import { remark } from "remark"
import gfm from "remark-gfm"
import math from "remark-math"
import katex from "katex"
import { normalizeMathMarkdown } from "./math-normalize.mjs"
import { normalizeCodeFences } from "./fence-normalize.mjs"
import { cacheRoot, quartzRoot, vaultRoot } from "./site-paths.mjs"

const parser = remark().use(gfm).use(math)
const posix = (value) => value.split(path.sep).join("/")
const label = (value) => value.replace(/[\[\]]/g, (character) => `\\${character}`)

// This historical prose outline was indented as code. Recover only its observed real image;
// all surrounding bytes and all fenced/inline code examples keep their original content.
function recoverKnownIndentedImage(markdown, source) {
  if (source !== "002-学习笔记/课程学习/计算机网络/读书笔记/读书笔记1.md") return markdown
  const changes = []
  function visit(node) {
    if (node.type === "code") {
      const from = node.position.start.offset,
        to = node.position.end.offset
      const raw = markdown.slice(from, to)
      if (
        node.lang == null &&
        !/^[\t ]*(?:`{3,}|~{3,})/.test(raw) &&
        raw.includes("每一个结点建立VC入口出口表")
      ) {
        const value = raw.replace(
          /^[\t ]+(!\[\[002-学习笔记\/课程学习\/计算机网络\/图片\/第一章\/VC入口出口表\.png\]\])[\t ]*$/gm,
          (_, image) => `\n\n${image}\n\n`,
        )
        if (value !== raw) changes.push({ from, to, value })
      }
      return
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(parser.parse(markdown))
  for (const change of changes.sort((a, b) => b.from - a.from))
    markdown = markdown.slice(0, change.from) + change.value + markdown.slice(change.to)
  return markdown
}

async function filesUnder(directory, prefix = "") {
  const files = []
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...(await filesUnder(directory, relative)))
    else if (entry.isFile()) files.push(posix(relative))
  }
  return files
}

function targetParts(raw) {
  const target = raw.split("|")[0].trim().replace(/^<|>$/g, "")
  const fragment = target.indexOf("#")
  const base = fragment < 0 ? target : target.slice(0, fragment)
  let decoded
  try {
    decoded = decodeURIComponent(base)
  } catch {
    decoded = base
  }
  return {
    base: decoded.replaceAll("\\", "/"),
    fragment: fragment < 0 ? "" : target.slice(fragment),
  }
}

/** Resolve against the source note before trying the vault root or a unique basename. */
function localTarget(raw, source, files) {
  const { base } = targetParts(raw)
  const targets = [
    base,
    ...(/\.excalidraw$/i.test(base) || !path.posix.extname(base) ? [base + ".md"] : []),
  ]
  const candidates = targets.flatMap((target) => [
    path.posix.normalize(path.posix.join(path.posix.dirname(source), target)),
    path.posix.normalize(target),
  ])
  for (const candidate of candidates) if (files.has(candidate)) return candidate
  const matches = [...files].filter((file) =>
    targets.some((target) => file === target || file.endsWith(`/${target}`)),
  )
  return matches.length === 1 ? matches[0] : undefined
}

export function rewriteEmbeds(markdown, { source, files, assets = {} }) {
  markdown = recoverKnownIndentedImage(markdown, source)
  const tree = parser.parse(markdown)
  const changes = [],
    mapped = [],
    missing = [],
    preservedMath = [],
    protectedRanges = []
  const definitions = new Map()
  // Some originals (e.g. 005-Excalidraw) aren't published, but their mapped PNGs are.
  const originPaths = new Set([
    ...files,
    ...Object.keys(assets).map((key) => targetParts(key).base),
  ])
  function collect(node) {
    if (node.type === "definition") definitions.set(node.identifier, node.url)
    for (const child of node.children ?? []) collect(child)
  }
  collect(tree)
  function mappedAsset(raw) {
    const { base, fragment } = targetParts(raw)
    const resolved = /^https?:/i.test(base) ? base : localTarget(raw, source, originPaths)
    const candidates = [raw.split("|")[0].trim(), ...(resolved ? [resolved + fragment] : [])]
    const result = candidates.map((key) => assets[key]).find((entry) => entry?.path)
    if (!result) return undefined
    const assetPath = posix(result.path)
    if (!files.has(assetPath)) throw new Error(`Mapped embed file is missing: ${assetPath}`)
    return assetPath
  }
  function imageReplacement(raw, alt, original) {
    const assetPath = mappedAsset(raw)
    if (assetPath) {
      mapped.push({ source, original, target: assetPath })
      return `![${label(alt || "原附件")}](${encodeURI(assetPath)})`
    }
    if (/^(?:https?:|data:|\/\/)/i.test(raw) || localTarget(raw, source, files)) return undefined
    missing.push({ source, original, reference: raw })
    return `**图片暂缺${alt ? `：${label(alt)}` : ""}**（原引用：\`${raw.replaceAll("`", "′")}\`）`
  }
  function visit(node) {
    const from = node.position?.start.offset,
      to = node.position?.end.offset
    if (["code", "inlineCode", "math", "inlineMath"].includes(node.type)) {
      protectedRanges.push({ from, to })
      if (node.type === "math" || node.type === "inlineMath") {
        try {
          katex.renderToString(node.value, {
            throwOnError: true,
            strict: "ignore",
            displayMode: node.type === "math",
          })
        } catch (error) {
          preservedMath.push({
            source,
            original: markdown.slice(from, to),
            latex: node.value,
            error: error.message,
          })
          const fence = "`".repeat(
            Math.max(3, ...[...node.value.matchAll(/`+/g)].map((match) => match[0].length + 1)),
          )
          changes.push({
            from,
            to,
            value: `\n\n公式暂以 LaTeX 源码保留（渲染不兼容）：\n\n${fence}latex\n${node.value}\n${fence}\n\n`,
          })
        }
      }
      return
    }
    if (node.type === "image" || node.type === "imageReference") {
      protectedRanges.push({ from, to })
      const raw = node.url ?? definitions.get(node.identifier)
      if (raw) {
        const value = imageReplacement(raw, node.alt, markdown.slice(from, to))
        if (value !== undefined) changes.push({ from, to, value })
      }
      return
    }
    if (node.type === "html") {
      protectedRanges.push({ from, to })
      const value = node.value.replace(
        /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
        (original, raw) => {
          const assetPath = mappedAsset(raw)
          if (assetPath) {
            mapped.push({ source, original, target: assetPath })
            return original.replace(/\bsrc=["'][^"']+["']/i, `src="${encodeURI(assetPath)}"`)
          }
          return (
            imageReplacement(raw, original.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "", original) ??
            original
          )
        },
      )
      if (value !== node.value) changes.push({ from, to, value })
      return
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  for (const match of markdown.matchAll(/(?<!\\)!\[\[([^\r\n]+?)\]\]/g)) {
    const from = match.index,
      to = from + match[0].length
    if (protectedRanges.some((range) => from < range.to && to > range.from)) continue
    const raw = match[1]
    const assetPath = mappedAsset(raw)
    if (assetPath) {
      mapped.push({ source, original: match[0], target: assetPath })
      const alias = raw.includes("|") ? raw.split("|").slice(1).join("|") : ""
      changes.push({
        from,
        to,
        // Quartz's downstream wiki parser also rejects brackets in aliases.
        value: /[\[\]]/.test(alias)
          ? `![${label(alias)}](${encodeURI(assetPath)})`
          : `![[${assetPath}${alias ? `|${alias}` : ""}]]`,
      })
    } else if (/\.(?:png|jpe?g|gif|webp|svg|bmp)(?:#.*)?$/i.test(raw.split("|")[0])) {
      const value = imageReplacement(raw, raw.split("|")[1] ?? "", match[0])
      if (value !== undefined) changes.push({ from, to, value })
    }
  }
  let text = markdown
  for (const change of changes.sort((a, b) => b.from - a.from))
    text = text.slice(0, change.from) + change.value + text.slice(change.to)
  return { text, mapped, missing, preservedMath }
}

export async function normalizeContent(
  contentRoot,
  {
    assetMapPath = path.join(vaultRoot, ".knowledge/quartz-assets.json"),
    reportPath = path.join(cacheRoot, "content-normalization.json"),
  } = {},
) {
  let assets = {}
  try {
    assets = JSON.parse(await readFile(assetMapPath, "utf8"))
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    // Keep deployment self-contained when the local migration workspace isn't tracked.
    try {
      assets = JSON.parse(await readFile(path.join(quartzRoot, "site-assets.json"), "utf8"))
    } catch (fallbackError) {
      if (fallbackError.code !== "ENOENT") throw fallbackError
    }
  }
  const files = new Set(await filesUnder(contentRoot))
  const report = {
    changedNotes: 0,
    mappedEmbeds: [],
    missingImages: [],
    preservedMath: [],
    assetMapPresent: Object.keys(assets).length > 0,
  }
  for (const relative of files) {
    if (!relative.startsWith("002-学习笔记/") || !relative.endsWith(".md")) continue
    if (process.env.QUARTZ_NORMALIZE_DEBUG === "1") console.log(`normalizing: ${relative}`)
    const file = path.join(contentRoot, relative)
    const original = await readFile(file, "utf8")
    const result = rewriteEmbeds(normalizeMathMarkdown(normalizeCodeFences(original)), {
      source: relative,
      files,
      assets,
    })
    report.mappedEmbeds.push(...result.mapped)
    report.missingImages.push(...result.missing)
    report.preservedMath.push(...result.preservedMath)
    if (result.text !== original) {
      const originalStat = await stat(file)
      await writeFile(file, result.text)
      await utimes(file, originalStat.atime, originalStat.mtime)
      report.changedNotes++
    }
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(
    `content-normalize: ${report.changedNotes} notes, ${report.mappedEmbeds.length} mapped embeds, ${report.missingImages.length} missing images, ${report.preservedMath.length} LaTeX fallbacks`,
  )
  return report
}
