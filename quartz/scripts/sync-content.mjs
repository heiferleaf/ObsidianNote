import { cp, lstat, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { cacheRoot, isMain, quartzRoot, vaultRoot } from "./site-paths.mjs"

// A fresh, ignored staging directory protects both the vault and existing content edits.
export async function syncContent({ sourceRoot = vaultRoot, stagingParent = cacheRoot } = {}) {
  for (const name of ["002-学习笔记", "003-Attachments"]) {
    if (!(await stat(path.join(sourceRoot, name))).isDirectory()) {
      throw new Error(`Missing source directory: ${name}`)
    }
  }
  await mkdir(stagingParent, { recursive: true })
  const directory = await mkdtemp(path.join(stagingParent, "site-content-"))
  for (const name of ["002-学习笔记", "003-Attachments"]) {
    await cp(path.join(sourceRoot, name), path.join(directory, name), {
      recursive: true,
      preserveTimestamps: true,
      filter: async (source) => !(await lstat(source)).isSymbolicLink(),
    })
  }
  // Dataview is an Obsidian runtime feature, so use the dedicated Quartz homepage.
  const homepage = await readFile(path.join(quartzRoot, "content", "index.md"), "utf8")
  await writeFile(path.join(directory, "index.md"), homepage)
  const result = {
    sourceRoot,
    directory,
    paths: ["002-学习笔记", "003-Attachments"],
    homepage: "quartz/content/index.md",
  }
  await writeFile(path.join(stagingParent, "site-sync.json"), JSON.stringify(result, null, 2))
  return result
}

if (isMain(import.meta.url)) {
  syncContent()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
