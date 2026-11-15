import path from "node:path"
import { fileURLToPath } from "node:url"

export const quartzRoot = fileURLToPath(new URL("../", import.meta.url))
export const vaultRoot = path.dirname(quartzRoot)
export const cacheRoot = path.join(quartzRoot, ".quartz-cache")
export const tagReportPath = path.join(cacheRoot, "tag-report.json")

export function isMain(url) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url)
}
