import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug, normalizeDisplayName } from "../util/path"

export interface TopicEntry {
  key: string
  title: string
  slug: FullSlug
  count: number
  latestModified?: Date
  latestTitle?: string
}

export interface RecentEntry {
  slug: FullSlug
  title: string
  modified?: Date
  topicPath: string
}

function getModifiedDate(file: QuartzPluginData): Date | undefined {
  const dates = file.dates as { created?: Date; modified?: Date } | undefined
  return dates?.modified ?? dates?.created
}

function getPageTitle(file: QuartzPluginData): string {
  const frontmatter = file.frontmatter as { title?: string } | undefined
  return frontmatter?.title ?? normalizeDisplayName(file.slug?.split("/").at(-1) ?? "")
}

function isContentPage(slug: string): boolean {
  return slug !== "index" && slug !== "404" && !slug.startsWith("tags/") && !slug.endsWith("/index")
}

export function buildTopicEntries(allFiles: QuartzPluginData[]): TopicEntry[] {
  const topics = new Map<string, TopicEntry>()

  for (const file of allFiles) {
    const slug = file.slug
    if (!slug || !isContentPage(slug)) continue

    const topicKey = slug.split("/")[0]
    if (!topicKey) continue

    const current = topics.get(topicKey) ?? {
      key: topicKey,
      title: normalizeDisplayName(topicKey),
      slug: `${topicKey}/index` as FullSlug,
      count: 0,
    }

    current.count += 1

    const modified = getModifiedDate(file)
    if (modified && (!current.latestModified || modified > current.latestModified)) {
      current.latestModified = modified
      current.latestTitle = getPageTitle(file)
    }

    topics.set(topicKey, current)
  }

  return Array.from(topics.values()).sort((a, b) => {
    const countDelta = b.count - a.count
    if (countDelta !== 0) return countDelta
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })
  })
}

export function buildRecentEntries(allFiles: QuartzPluginData[]): RecentEntry[] {
  return allFiles
    .filter((file) => file.slug !== undefined && isContentPage(file.slug))
    .map((file) => {
      const slug = file.slug as FullSlug
      const slugParts = slug.split("/")
      const topicPath = slugParts.slice(0, -1).join(" / ")
      return {
        slug,
        title: getPageTitle(file),
        modified: getModifiedDate(file),
        topicPath: topicPath ? topicPath.split("/").map(normalizeDisplayName).join(" · ") : "",
      }
    })
    .sort((a, b) => {
      const leftTime = a.modified?.getTime() ?? 0
      const rightTime = b.modified?.getTime() ?? 0
      return rightTime - leftTime || a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })
    })
}