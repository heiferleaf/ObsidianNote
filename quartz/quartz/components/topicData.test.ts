import assert from "node:assert/strict"
import test from "node:test"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug } from "../util/path"
import { buildRecentEntries, buildTopicEntries } from "./topicData"

const note = (slug: string, title: string, modified = "2026-01-01"): QuartzPluginData => ({
  slug: slug as FullSlug,
  frontmatter: { title, tags: [] },
  dates: {
    created: new Date(modified),
    modified: new Date(modified),
    published: new Date(modified),
  },
})

test("subjects have distinct stable folder links and accurate note counts", () => {
  const files = [
    note("002-学习笔记/技术栈/JAVA-EE/基础", "基础"),
    note("002-学习笔记/技术栈/JAVA-EE/笔记/集合", "集合", "2026-02-01"),
    note("002-学习笔记/课程学习/编译原理/词法分析", "词法分析"),
    note("002-学习笔记/零碎知识笔记/跨域", "跨域"),
    note("003-Attachments/草图", "草图"),
    note("002-学习笔记/技术栈/JAVA-EE/index", "索引"),
    note("index", "首页"),
  ]
  const topics = buildTopicEntries(files)
  assert.equal(topics.length, 3)
  assert.equal(topics[0].slug, "002-学习笔记/技术栈/JAVA-EE/index")
  assert.equal(topics[0].count, 2)
  assert.equal(topics[0].category, "技术栈")
  assert.equal(topics[0].latestTitle, "集合")
  const recent = buildRecentEntries(files)
  assert.equal(recent.length, 4)
  assert.equal(recent[0].title, "集合")
  assert.equal(recent[0].topicPath, "技术栈 · JAVA EE · 笔记")
})
