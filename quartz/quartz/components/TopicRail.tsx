import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/topicRail.scss"
import script from "./scripts/topicRail.inline"
import { FullSlug, resolveRelative } from "../util/path"
import { buildTopicEntries } from "./topicData"
export default (() => {
  const TopicRail: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
    const topics = buildTopicEntries(allFiles)
    const categories = [...new Set(topics.map((topic) => topic.category))]
    return <nav class="topic-rail" aria-label="笔记专题"><details class="topic-menu" open><summary class="rail-heading"><span>浏览专题</span><span class="rail-summary">{topics.length}</span></summary><div class="rail-content"><a class="rail-home internal" aria-current={fileData.slug === "index" ? "page" : undefined} href={resolveRelative(fileData.slug!, "index" as FullSlug)}><span>⌂ <span>知识首页</span></span><span aria-hidden="true">↗</span></a><a class="rail-all internal" href={resolveRelative(fileData.slug!, "002-学习笔记/index" as FullSlug)}><span>▤ <span>全部笔记</span></span><span aria-hidden="true">↗</span></a>{categories.map((category) => <section class="rail-group"><h3>{category}</h3><ul class="topic-list">{topics.filter((topic) => topic.category === category).map((topic) => <li><a class="topic-link internal" href={resolveRelative(fileData.slug!, topic.slug)} aria-current={fileData.slug?.startsWith(`${topic.key}/`) ? "location" : undefined}><span class="topic-name">{topic.title}</span><span class="topic-count">{topic.count}</span></a></li>)}</ul></section>)}<a class="rail-tags internal" href={resolveRelative(fileData.slug!, "tags/index" as FullSlug)}>按标签探索 <span aria-hidden="true">↗</span></a></div></details></nav>
  }
  TopicRail.css = style
  TopicRail.afterDOMLoaded = script
  return TopicRail
}) satisfies QuartzComponentConstructor
