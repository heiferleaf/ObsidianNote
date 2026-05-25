import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import style from "./styles/homePage.scss"
import { buildRecentEntries, buildTopicEntries } from "./topicData"
import { Date } from "./Date"

export default ((userOpts?: any) => {
  const HomePage: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
    const topicList = buildTopicEntries(allFiles)
    const recentList = buildRecentEntries(allFiles).slice(0, 6)
    const newest = recentList[0]

    return (
      <div class="home-page">
        <section class="home-hero">
          <p class="eyebrow">Obsidian Note Atlas</p>
          <h1 class="hero-title">把笔记整理成一张可走的地图。</h1>
          <p class="hero-copy">
            这里不是仓库树，而是按专题直接进入的学习站。你可以从专题卡片、最近更新和侧栏快捷入口继续深入，按知识主题而不是文件夹层级浏览。
          </p>
          <div class="hero-stats">
            <div class="stat-card">
              <span class="stat-label">专题</span>
              <span class="stat-value">{topicList.length}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">最近更新</span>
              <span class="stat-value">{recentList.length}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">最新笔记</span>
              <span class="stat-value">{newest?.title ?? "-"}</span>
            </div>
          </div>
        </section>

        <section>
          <div class="section-header">
            <h2>专题入口</h2>
            <p>直接进入专题页，不暴露目录前缀。</p>
          </div>
          <div class="topic-grid">
            {topicList.map((topic) => (
              <a class="topic-card" href={resolveRelative(fileData.slug!, topic.slug)}>
                <div class="topic-name">{topic.title}</div>
                <div class="topic-count">{topic.count} 篇笔记</div>
                <div class="topic-count">
                  {topic.latestTitle ? `最近更新：${topic.latestTitle}` : "最近更新：-"}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section>
          <div class="section-header">
            <h2>最近更新</h2>
            <p>按修改时间排序。</p>
          </div>
          <div class="recent-list">
            {recentList.map((item) => (
              <a class="recent-item" href={resolveRelative(fileData.slug!, item.slug)}>
                <div class="recent-title">{item.title}</div>
                <div class="recent-meta">
                  {item.topicPath ? `${item.topicPath} · ` : ""}
                  {item.modified ? <Date date={item.modified} locale={cfg.locale} /> : ""}
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    )
  }

  HomePage.css = style
  return HomePage
}) satisfies QuartzComponentConstructor
