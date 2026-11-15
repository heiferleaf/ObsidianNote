import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { cacheRoot, vaultRoot } from "./site-paths.mjs"
import { extractFrontmatter, normalizeTags, slugify, withSuggestedTags } from "./tag-normalize.mjs"
import { syncContent } from "./sync-content.mjs"
import { normalizeMath, normalizeMathMarkdown } from "./math-normalize.mjs"
import { normalizeContent, rewriteEmbeds } from "./normalize-content.mjs"
import { remark } from "remark"
import remarkMath from "remark-math"
import katex from "katex"
import { normalizeCodeFences } from "./fence-normalize.mjs"

test("the original quoted Java example preserves every dollar in generated identifiers", async () => {
  const source = await readFile(
    path.join(vaultRoot, "002-学习笔记/技术栈/现代编程思想/Course6 函数式编程.md"),
    "utf8",
  )
  const mathOnly = normalizeMathMarkdown(source)
  assert.ok(mathOnly.includes("StreamClass$$Lambda$1"))
  assert.ok(mathOnly.includes("StreamClass.lambda$test0$0(s1, s2)"))
  assert.ok(!mathOnly.includes("StreamClass$Lambda$1"))
  const tree = remark().parse(normalizeMathMarkdown(normalizeCodeFences(source)))
  const codes = [],
    headings = []
  const visit = (node) => {
    if (node.type === "code") codes.push(node.value)
    if (node.type === "heading")
      headings.push(node.children.map((child) => child.value ?? "").join(""))
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  assert.ok(
    codes.some((code) =>
      code.includes("final class StreamClass$$Lambda$1 implements Comparator<String>"),
    ),
  )
  assert.ok(headings.includes("高级函数式编程"))
})

test("quote/list fence recovery preserves configuration, diagrams, and EOF code without swallowing following prose", () => {
  const input =
    '> ```java\n> final class X$$Lambda$1 {\n  int n = 1;\n> }\n> ```\n正文\n\t```json\n{\n  "$schema": "example",\n  "env": { "TOKEN": "$value" }\n}\n\t```\n## 下一节\n> ```text\n> A --> B\n>     |\n>     v\n>     C\n> ```\n```text\nEOF说明'
  const output = normalizeCodeFences(input)
  const tree = remark().parse(output)
  const codes = []
  const collect = (node) => {
    if (node.type === "code") codes.push(node)
    for (const child of node.children ?? []) collect(child)
  }
  collect(tree)
  assert.deepEqual(
    codes.map((node) => node.value),
    [
      "final class X$$Lambda$1 {\n  int n = 1;\n}",
      '{\n  "$schema": "example",\n  "env": { "TOKEN": "$value" }\n}',
      "A --> B\n    |\n    v\n    C",
      "EOF说明",
    ],
  )
  assert.ok(tree.children.some((node) => node.type === "heading"))
  assert.ok(
    tree.children.some(
      (node) => node.type === "paragraph" && node.children.some((child) => child.value === "正文"),
    ),
  )
  assert.ok(normalizeMathMarkdown(output).includes('"$schema"'))
})

test("complete quote and list code fences retain their container and every code byte", () => {
  const input =
    '> **重要**：Java字符串转义\n> ```java\n> String regex = "\\\\d\\\\d";\n> String id = "X$$Lambda$1";\n> > ```\n> ```\n\n- 示例\n    ```text\n    a  b\n    ```'
  assert.equal(normalizeCodeFences(input), input)
  const tree = remark().parse(normalizeCodeFences(input))
  assert.equal(tree.children[0].type, "blockquote")
  assert.equal(tree.children[0].children[1].type, "code")
  assert.equal(tree.children[1].type, "list")
  assert.equal(tree.children[1].children[0].children[1].value, "a  b")
})

test("math compatibility preserves notation and handles Markdown boundaries without consuming prose or code", () => {
  const formula = String.raw`\begin{aligned}\Q &\cong \Z \\ (R$S)^{-1}=R^{-1}\$S^{-1}\end{aligned}`
  const normalized = normalizeMath(formula)
  assert.doesNotThrow(() =>
    katex.renderToString(normalized, { throwOnError: true, strict: "ignore" }),
  )
  assert.equal(normalizeMath(normalized), normalized)
  assert.doesNotThrow(() =>
    katex.renderToString(normalizeMath(String.raw`\text{Cost \$10}`), {
      throwOnError: true,
      strict: "ignore",
    }),
  )
  assert.equal(
    normalizeMath(String.raw`\sum_{i=1}^n x_i + 中文`),
    String.raw`\sum_{i=1}^n x_i + 中文`,
  )
  assert.equal(normalizeMath(String.raw`\unknownMacro{x}`), String.raw`\unknownMacro{x}`)
  const code = "```java\nclass X$$Lambda$1 {}\n```"
  const source = `${code}\n$x^T$$x$的转置。\n> 公式：$$x&=y\\\\$$继续说明\n下一段。`
  const result = normalizeMathMarkdown(source)
  assert.ok(result.includes(code))
  assert.ok(result.includes("$x^T$ $x$的转置。"))
  assert.ok(result.includes("继续说明"))
  assert.ok(result.includes("下一段。"))
  // The display delimiter immediately after an even number of backslashes is real.
  assert.ok(result.includes("x&=y\\\\"))
  const tree = remark()
    .use(remarkMath)
    .parse(normalizeMathMarkdown("前文$$x^2$$后文\n> $$\n> a+b\n> $$\n> 结论"))
  const mathValues = []
  const visit = (node) => {
    if (node.type === "math") mathValues.push(node.value.trim())
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  assert.deepEqual(mathValues, ["x^2", "a+b"])
  const greater = normalizeMathMarkdown("$$\nx\\\\\n>0\n$$\n> $$\n> x\\\\\n> >0\n> $$")
  const greaterTree = remark().use(remarkMath).parse(greater)
  const values = []
  const check = (node) => {
    if (node.type === "math") values.push(node.value.trim())
    for (const child of node.children ?? []) check(child)
  }
  check(greaterTree)
  assert.deepEqual(values, ["x\\\\\n>0", "x\\\\\n>0"])
})

test("materialized images replace true embeds while PDF links and code examples remain intact", () => {
  const source = "002-学习笔记/课程学习/示例.md"
  const image = "003-Attachments/pages-import/materialized.png"
  const assets = {
    "003-Attachments/图.excalidraw.md": { path: image },
    "003-Attachments/书.pdf#page=2": { path: image },
    "https://example.org/a.png": { path: image },
  }
  const files = new Set([
    "003-Attachments/图.excalidraw.md",
    "003-Attachments/书.pdf",
    image,
    "002-学习笔记/课程学习/pictures/a.png",
  ])
  const code = "```md\n![[图.excalidraw.md]]\n![例](https://example.org/a.png)\n```"
  const ordinaryLink = "[原始PDF](../../003-Attachments/书.pdf#page=2)"
  const input = `${code}\n\`![[图.excalidraw.md]]\`\n![[图.excalidraw.md|400]]\n![[../../003-Attachments/书.pdf#page=2]]\n![外链图](https://example.org/a.png)\n${ordinaryLink}\n![现有图](./pictures/a.png)\n![缺图](missing.png)`
  const result = rewriteEmbeds(input, { source, files, assets })
  assert.equal(result.mapped.length, 3)
  assert.ok(result.text.includes(code))
  assert.ok(result.text.includes("`![[图.excalidraw.md]]`"))
  assert.ok(result.text.includes(ordinaryLink))
  assert.ok(result.text.includes("![现有图](./pictures/a.png)"))
  assert.ok(result.text.includes(`![[${image}|400]]`))
  assert.ok(result.text.includes("**图片暂缺：缺图**（原引用：`missing.png`）"))
  assert.equal(result.missing.length, 1)
  const html = rewriteEmbeds('<figure><img src="https://example.org/a.png" alt="图"></figure>', {
    source,
    files,
    assets,
  })
  assert.ok(html.text.includes(`<img src="${image}" alt="图">`))
  assert.ok(html.text.includes("<figure>"))
  const drawing = rewriteEmbeds("![[图.excalidraw]]\n![[外部图.excalidraw]]", {
    source,
    files: new Set([image]),
    assets: { ...assets, "005-Excalidraw/外部图.excalidraw.md": { path: image } },
  })
  assert.equal(drawing.mapped.length, 2)
  assert.ok(!drawing.text.includes("图.excalidraw"))
})

test("unknown math is explicitly preserved as LaTeX code instead of silently removed", () => {
  const result = rewriteEmbeds("$$\n\\unknownMacro{x}\n$$", { source: "note.md", files: new Set() })
  assert.equal(result.preservedMath.length, 1)
  assert.ok(result.text.includes("公式暂以 LaTeX 源码保留"))
  assert.ok(result.text.includes("```latex\n\\unknownMacro{x}\n```"))
})

test("wiki PDF excerpts accept single brackets in book titles without crossing lines or code", () => {
  const source = "002-学习笔记/技术栈/数据结构与算法/笔记/递归程序.md"
  const book = "009-电子书籍/[沙特]M. H. Alsuwaiyel 算法.pdf"
  const images = [
    "003-Attachments/pages-import/page2.png",
    "003-Attachments/pages-import/page3.png",
  ]
  const assets = {
    [`${book}#page=2`]: { path: images[0] },
    [`${book}#page=3`]: { path: images[1] },
    "书`代码`名.pdf#page=2": { path: images[0] },
  }
  const code = `\`\`\`md\n![[${book}#page=2]]\n\`\`\``
  const inline = `\`![[${book}#page=2]]\``
  const multiline = `![[${book}\n#page=2]]`
  const crossing = "![[书`代码`名.pdf#page=2]]"
  const result = rewriteEmbeds(
    `![[${book}#page=2|[沙特]原书 p.2]]\n![[${book}#page=3|[沙特]原书 p.3]]\n${code}\n${inline}\n${multiline}\n${crossing}`,
    { source, files: new Set(images), assets },
  )
  assert.equal(result.mapped.length, 2)
  const renderedImages = []
  const collect = (node) => {
    if (node.type === "image") renderedImages.push(node.url)
    for (const child of node.children ?? []) collect(child)
  }
  collect(remark().parse(result.text))
  assert.deepEqual(renderedImages, images)
  for (const protectedText of [code, inline, multiline, crossing])
    assert.ok(result.text.includes(protectedText))
})

test("only the known VC prose image escapes indentation; examples and surrounding text stay intact", () => {
  const source = "002-学习笔记/课程学习/计算机网络/读书笔记/读书笔记1.md"
  const image = "002-学习笔记/课程学习/计算机网络/图片/第一章/VC入口出口表.png"
  const target = "003-Attachments/pages-import/vc.png"
  const before = "\t\t\t每一个结点建立VC入口出口表"
  const after = "\t\t- 特点：\n\t\t\t- 数据包可以没有地址，只需要VC号，包头更小"
  const prose = `${before}\n\t\t\t![[${image}]]\n${after}`
  const fenced = `\`\`\`md\n${prose}\n\`\`\``
  const example = `\t\t\t代码示例\n\t\t\t![[${image}]]`
  const options = { source, files: new Set([target]), assets: { [image]: { path: target } } }
  const result = rewriteEmbeds(`${prose}\n\n${fenced}\n\n${example}`, options)
  assert.equal(result.mapped.length, 1)
  assert.ok(result.text.includes(`\n\n![[${target}]]\n\n`))
  for (const preserved of [before, after, fenced, example])
    assert.ok(result.text.includes(preserved))
  assert.equal(rewriteEmbeds(prose, { ...options, source: "another-note.md" }).text, prose)
})

test("normalization walks nested notes once, honors an absent optional map, and preserves timestamps", async (t) => {
  const directory = await fixture(t)
  const notes = path.join(directory, "002-学习笔记/课程学习")
  await mkdir(notes, { recursive: true })
  const file = path.join(notes, "示例.md")
  await writeFile(file, "前文$$x^2$$后文\n![缺图](missing.png)")
  const before = await stat(file)
  const map = path.join(directory, "assets.json")
  await writeFile(map, "{}")
  const report = await normalizeContent(directory, {
    assetMapPath: map,
    reportPath: path.join(directory, "report.json"),
  })
  assert.equal(report.changedNotes, 1)
  assert.equal(report.missingImages.length, 1)
  assert.equal(report.preservedMath.length, 0)
  assert.equal(report.assetMapPresent, false)
  assert.ok(Math.abs((await stat(file)).mtimeMs - before.mtimeMs) < 2)
})

async function fixture(t) {
  await mkdir(cacheRoot, { recursive: true })
  const directory = await mkdtemp(path.join(cacheRoot, "site-test-"))
  t.after(async () => {
    assert.ok(path.relative(cacheRoot, directory).startsWith("site-test-"))
    await rm(directory, { recursive: true, force: true })
  })
  return directory
}

test("Chinese tags survive normalization; existing tags and YAML lists stay intact", () => {
  assert.equal(slugify("计算机 网络 / TCP"), "计算机-网络-tcp")
  const source =
    "---\r\ntitle: 计算机网络\r\naliases:\r\n  - 网络基础\r\ncssclasses:\r\n  - wide\r\n---\r\n# 正文\r\n$$x^2$$\r\n"
  const updated = withSuggestedTags(source, ["计算机网络", "tcp"])
  assert.deepEqual(extractFrontmatter(updated).data.aliases, ["网络基础"])
  assert.deepEqual(extractFrontmatter(updated).data.cssclasses, ["wide"])
  assert.deepEqual(extractFrontmatter(updated).data.tags, ["计算机网络", "tcp"])
  assert.ok(updated.endsWith("---\r\n# 正文\r\n$$x^2$$\r\n"))
  assert.equal(withSuggestedTags(updated, ["新标签"]), updated)
  assert.equal(
    withSuggestedTags("---\ntag: 保留\n---\n正文", ["新增"]),
    "---\ntag: 保留\n---\n正文",
  )
  assert.equal(withSuggestedTags("---\ntags: []\n---\n正文", ["新增"]), "---\ntags: []\n---\n正文")
  assert.deepEqual(extractFrontmatter(withSuggestedTags("\uFEFF正文", ["中文"])).data.tags, [
    "中文",
  ])
})

test("tag generation is repeatable and preserves file modification times", async (t) => {
  const directory = await fixture(t)
  const folder = path.join(directory, "002-学习笔记/课程学习/计算机网络")
  await mkdir(folder, { recursive: true })
  const file = path.join(folder, "TCP.md")
  await writeFile(file, "# TCP 连接\n正文\n")
  const before = await stat(file)
  const options = {
    contentRoot: directory,
    reportPath: path.join(directory, "report.json"),
    apply: true,
  }
  const first = await normalizeTags(options)
  assert.equal(first.items.length, 1)
  assert.ok(first.items[0].suggested.includes("计算机网络"))
  const text = await readFile(file, "utf8")
  const second = await normalizeTags(options)
  assert.equal(second.items.length, 0)
  assert.equal(await readFile(file, "utf8"), text)
  assert.ok(Math.abs((await stat(file)).mtimeMs - before.mtimeMs) < 2)
})

test("sync preserves vault paths, skips Dashboard, and never overwrites source or an earlier stage", async (t) => {
  const directory = await fixture(t)
  const sourceRoot = path.join(directory, "vault")
  await mkdir(path.join(sourceRoot, "002-学习笔记"), { recursive: true })
  await mkdir(path.join(sourceRoot, "003-Attachments"))
  const original = "# 笔记\n![[003-Attachments/图.png]]\n"
  await writeFile(path.join(sourceRoot, "002-学习笔记/测试.md"), original)
  await writeFile(path.join(sourceRoot, "003-Attachments/图.png"), "asset")
  await writeFile(path.join(sourceRoot, "000-Dashboard.md"), "```dataview\nTABLE\n```")
  const first = await syncContent({ sourceRoot, stagingParent: path.join(directory, "staging") })
  const second = await syncContent({ sourceRoot, stagingParent: path.join(directory, "staging") })
  assert.notEqual(first.directory, second.directory)
  assert.equal(await readFile(path.join(first.directory, "002-学习笔记/测试.md"), "utf8"), original)
  assert.equal(
    await readFile(path.join(first.directory, "003-Attachments/图.png"), "utf8"),
    "asset",
  )
  assert.equal(await readFile(path.join(sourceRoot, "002-学习笔记/测试.md"), "utf8"), original)
  assert.doesNotMatch(await readFile(path.join(first.directory, "index.md"), "utf8"), /dataview/)
})
