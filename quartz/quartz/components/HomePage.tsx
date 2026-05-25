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
          <div class="profile-card">
            <div class="profile-badge" aria-hidden="true">
              <svg viewBox="0 0 64 64" class="whu-icon" role="img" aria-label="武汉大学图标">
                <path d="M12 48V20l20-10 20 10v28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" />
                <path d="M18 28h28M18 36h28M24 48V28m16 20V28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
                <circle cx="32" cy="18" r="4" fill="currentColor" />
              </svg>
            </div>
            <div class="profile-copy">
              <p class="eyebrow">个人主页</p>
              <h1 class="hero-title">yhf</h1>
              <p class="hero-copy">武汉大学软件工程专业本科生。</p>
              <div class="profile-tags">
                <span class="profile-tag">武汉大学</span>
                <span class="profile-tag">软件工程</span>
                <span class="profile-tag">本科生</span>
              </div>
            </div>
          </div>
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
            <p>按专题继续深入。</p>
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
