import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { syncContent } from "./sync-content.mjs"
import { normalizeTags } from "./tag-normalize.mjs"
import { normalizeContent } from "./normalize-content.mjs"
import { cacheRoot, isMain, quartzRoot } from "./site-paths.mjs"

export async function validateOutput(output) {
  const homepage = await readFile(path.join(output, "index.html"), "utf8")
  if (/language-dataview|dataviewjs/.test(homepage))
    throw new Error("Homepage contains an unrendered Dataview block")
  const contentIndex = JSON.parse(
    await readFile(path.join(output, "static/contentIndex.json"), "utf8"),
  )
  for (const slug of Object.keys(contentIndex)) {
    if (!(await stat(path.join(output, `${slug}.html`))).isFile())
      throw new Error(`Missing indexed page: ${slug}`)
  }
  const navigation = [
    ...homepage.matchAll(
      /class="(?:topic-card|topic-link|recent-item|mini-item)[^"]*"[^>]*href="([^"]+)"/g,
    ),
  ]
  if (navigation.length === 0) throw new Error("Homepage navigation is empty")
  for (const [, href] of navigation) {
    const target = decodeURIComponent(
      new URL(href.replaceAll("&amp;", "&"), "https://preview.local/").pathname,
    ).slice(1)
    const candidates = [
      path.join(output, `${target}.html`),
      path.join(output, target, "index.html"),
    ]
    const exists = await Promise.all(
      candidates.map((candidate) =>
        stat(candidate)
          .then((entry) => entry.isFile())
          .catch(() => false),
      ),
    )
    if (!exists.some(Boolean)) throw new Error(`Missing navigation target: ${href}`)
  }
  const sitemap = await readFile(path.join(output, "sitemap.xml"), "utf8")
  if (!sitemap.includes("https://heiferleaf.github.io/ObsidianNote/"))
    throw new Error("Incorrect sitemap base URL")
  let localImages = 0
  const issues = []
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await inspect(file)
        continue
      }
      if (!entry.name.endsWith(".html")) continue
      const html = await readFile(file, "utf8")
      const relative = path.relative(output, file).split(path.sep).join("/")
      if (/class="[^"]*\bkatex-error\b/.test(html))
        issues.push({ page: relative, reason: "KaTeX render error" })
      for (const [, raw] of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
        if (/^(?:https?:|data:|\/\/)/i.test(raw)) continue
        localImages++
        const url = new URL(raw.replaceAll("&amp;", "&"), `https://preview.local/${relative}`)
        const target = path.join(output, decodeURIComponent(url.pathname).slice(1))
        if (
          !(await stat(target)
            .then((entry) => entry.isFile())
            .catch(() => false))
        )
          issues.push({ page: relative, reason: "Missing local image", source: raw })
      }
    }
  }
  await inspect(output)
  if (issues.length)
    throw new Error(`Rendered content validation failed: ${JSON.stringify(issues)}`)
  await writeFile(path.join(output, ".nojekyll"), "")
  return {
    indexedPages: Object.keys(contentIndex).length,
    checkedNavigationLinks: navigation.length,
    checkedLocalImages: localImages,
    renderedMathErrors: 0,
  }
}

async function buildSite() {
  const stage = await syncContent()
  await normalizeTags({ contentRoot: stage.directory, apply: true })
  await normalizeContent(stage.directory)
  const code = await new Promise((resolve, reject) => {
    const contentPath = path.relative(quartzRoot, stage.directory).split(path.sep).join("/")
    const child = spawn(
      process.execPath,
      ["./quartz/bootstrap-cli.mjs", "build", "--directory", contentPath],
      {
        cwd: quartzRoot,
        stdio: "inherit",
        env: { ...process.env, QUARTZ_STAGED_CONTENT: "1" },
      },
    )
    child.on("error", reject)
    child.on("exit", resolve)
  })
  if (code !== 0) throw new Error(`Quartz build failed (${code})`)
  const validation = await validateOutput(path.join(quartzRoot, "public"))
  const report = { completedAt: new Date().toISOString(), ...stage, ...validation }
  await writeFile(path.join(cacheRoot, "site-build.json"), JSON.stringify(report, null, 2))
  console.log(
    `Validated ${validation.indexedPages} indexed pages and ${validation.checkedNavigationLinks} homepage navigation links.`,
  )
}

if (isMain(import.meta.url))
  buildSite().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
