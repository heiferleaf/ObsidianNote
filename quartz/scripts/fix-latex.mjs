import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const contentRoot = path.resolve(process.cwd(), "content")

async function walkMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath)
    }
  }

  return files
}

function flattenDisplayMathBlock(blockLines) {
  // 支持被 blockquote 前缀 (例如 "> ") 包裹的行。
  const prefixMatch = blockLines[0].match(/^\s*(?:>\s*)*/)
  const openingPrefix = prefixMatch ? prefixMatch[0] : ""

  // 去掉每行的前缀再处理内容
  const stripPrefix = (line) => line.startsWith(openingPrefix) ? line.slice(openingPrefix.length) : line

  const openingLine = stripPrefix(blockLines[0])
  const closingLine = stripPrefix(blockLines[blockLines.length - 1])
  const openingStart = openingLine.indexOf("$$")
  const closingEnd = closingLine.lastIndexOf("$$")

  if (openingStart === -1 || closingEnd === -1) {
    return blockLines.join("\n")
  }

  const openingBody = openingLine.slice(openingStart + 2).trim()
  const closingBody = closingLine.slice(0, closingEnd).trim()
  const innerLines = blockLines.slice(1, -1).map((line) => stripPrefix(line).trim())
  const parts = [openingBody, ...innerLines, closingBody].filter(Boolean)
  const flattened = parts.join(" ").replace(/\s+/g, " ").trim()

  return `${openingPrefix}${flattened}$$`
}

function rewriteMarkdown(content) {
  const lines = content.split(/\r?\n/)
  const output = []
  let inFence = false
  let fenceMarker = ""
  let mathBlock = null

  // 正则：捕获可能的 blockquote 前缀（例如 "> ", ">> " 等）
  const prefixRegex = /^(\s*(?:>\s*)*)/

  for (const line of lines) {
    const prefixMatch = line.match(prefixRegex)
    const prefix = prefixMatch ? prefixMatch[0] : ""
    const rest = line.slice(prefix.length)
    const restTrim = rest.trimStart()

    if (inFence) {
      output.push(line)
      if (restTrim.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ""
      }
      continue
    }

    if (restTrim.startsWith("```") || restTrim.startsWith("~~~")) {
      inFence = true
      fenceMarker = restTrim.slice(0, 3)
      output.push(line)
      continue
    }

    if (mathBlock) {
      mathBlock.push(line)
      const endRest = line.slice(prefix.length).trimEnd()
      if (endRest.endsWith("$$")) {
        output.push(flattenDisplayMathBlock(mathBlock))
        mathBlock = null
      }
      continue
    }

    if (restTrim.startsWith("$$") && !restTrim.endsWith("$$")) {
      mathBlock = [line]
      continue
    }

    output.push(line)
  }

  if (mathBlock) {
    output.push(...mathBlock)
  }

  const joined = output.join("\n")
  // 修复形如 `$$ ... $ $...` 的错误：将中间的 `"$ <空白> $"` 合并为 `"$$ $"`，保持后续内联公式不变
  const fixedSplitDoubleDollar = joined.replace(/\$\$([^\$]*?)\$\s+\$/gs, '$$$1$$ $')
  // 把可能出现的连续三重美元符号 $$$ 替换成 $$ + 空格 + $，避免紧邻导致的解析错误
  return fixedSplitDoubleDollar.replace(/\$\$\$/g, "$$ $")
}

async function main() {
  const files = await walkMarkdownFiles(contentRoot)
  let changedCount = 0

  for (const filePath of files) {
    const original = await readFile(filePath, "utf8")
    const updated = rewriteMarkdown(original)

    if (updated !== original) {
      await writeFile(filePath, updated, "utf8")
      changedCount += 1
    }
  }

  console.log(`latex-fix: processed ${files.length} markdown files, updated ${changedCount}`)
}

main().catch((error) => {
  console.error("latex-fix failed:", error)
  process.exitCode = 1
})