import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/homePage.scss"
import script from "./scripts/homePage.inline"
import { buildRecentEntries, buildTopicEntries } from "./topicData"
import { Date } from "./Date"

export default (() => {
  const HomePage: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
    const topics = buildTopicEntries(allFiles)
    const notes = buildRecentEntries(allFiles)
    const categories = [...new Set(topics.map((topic) => topic.category))]
    const shelf = ["计算机系统基础", "机器学习", "JAVA EE"].map((name) => topics.find((topic) => topic.title === name)).filter((topic) => topic !== undefined)
    return (
      <div class="home-page">
        <div class="home-topline"><span>一个持续生长的知识库</span><span class="home-status"><i /> KEEP LEARNING</span></div>
        <section class="home-hero" aria-labelledby="home-title">
          <div class="hero-copy">
            <p class="eyebrow">YHF / FIELD NOTES</p>
            <h1 id="home-title">保持好奇，<br />让知识<span>相连。</span></h1>
            <p class="hero-intro">关于软件、系统与思考的长期笔记。<br />记录理解，也留住那些还没想明白的问题。</p>
            <button class="home-search-launch" aria-label="搜索笔记"><span class="search-glyph" aria-hidden="true">⌕</span><span>搜索笔记、概念或问题</span><kbd aria-hidden="true">Ctrl K</kbd></button>
            <div class="hero-footnote"><span>武汉大学 · 软件工程</span><span>{notes.length} 篇笔记 <b>·</b> {topics.length} 个专题</span></div>
          </div>
          <div class="hero-shelf" aria-label="从三个专题开始阅读">
            <div class="shelf-caption"><span>THE READING SHELF</span><span>从一个问题开始 ↙</span></div>
            <div class="shelf-books">{shelf.map((topic, index) => <a class={`shelf-book book-${index + 1} internal`} href={resolveRelative(fileData.slug!, topic.slug)}><div class="book-top"><span>VOL. 0{index + 1}</span><span aria-hidden="true">↗</span></div><div class="book-title">{topic.title === "计算机系统基础" ? <>计算机<br />系统基础</> : topic.title === "JAVA EE" ? <>Java<br />&amp; Beyond</> : <>机器<br />学习</>}</div><div class="book-rule" aria-hidden="true" /><div class="book-bottom"><span>{topic.category}</span><strong>{topic.count}<small> 篇</small></strong></div></a>)}</div>
            <p class="shelf-note">READ. THINK. CONNECT.</p>
          </div>
        </section>
        <section class="recent-section" aria-labelledby="recent-title">
          <div class="section-heading"><div><span class="section-kicker">01 / RECENT NOTES</span><h2 id="recent-title">最近更新<span>↗</span></h2></div><a class="section-link internal" href={resolveRelative(fileData.slug!, "002-学习笔记/index" as FullSlug)}>全部笔记 <span aria-hidden="true">↗</span></a></div>
          <div class="recent-list">{notes.slice(0, 5).map((item, index) => <a class="recent-item internal" href={resolveRelative(fileData.slug!, item.slug)}><span class="recent-number">{String(index + 1).padStart(2, "0")}</span><div class="recent-copy"><span class="recent-title">{item.title}</span><span class="recent-topic">{item.topicPath}</span></div><span class="recent-date">{item.modified ? <Date date={item.modified} locale={cfg.locale} /> : ""}</span><span class="recent-arrow" aria-hidden="true">↗</span></a>)}</div>
        </section>
        <section id="topics" class="directory-section" aria-labelledby="directory-title">
          <div class="section-heading"><div><span class="section-kicker">02 / THE COLLECTION</span><h2 id="directory-title">知识目录<span>({topics.length})</span></h2></div><p>顺着好奇心，继续往下读。</p></div>
          <div class="topic-filters" aria-label="按学习场景筛选专题"><button data-topic-filter="all" aria-pressed="true">全部</button>{categories.map((category) => <button data-topic-filter={category} aria-pressed="false">{category}</button>)}</div>
          <div class="topic-grid">{topics.map((topic, index) => <a class="topic-card internal" data-category={topic.category} href={resolveRelative(fileData.slug!, topic.slug)}><span class="topic-number">{String(index + 1).padStart(2, "0")}</span><span class="topic-card-copy"><span class="topic-category">{topic.category}</span><span class="topic-name">{topic.title}</span></span><span class="topic-count">{topic.count}<small> 篇</small></span><span class="topic-arrow" aria-hidden="true">↗</span></a>)}</div>
          <p class="directory-result" aria-live="polite">全部 {topics.length} 个专题</p>
        </section>
        <div class="home-colophon"><span>yhf. <small>把学过的知识，留给下一次思考。</small></span><a class="internal" href={resolveRelative(fileData.slug!, "tags/index" as FullSlug)}>按标签探索 ↗</a></div>
      </div>
    )
  }
  HomePage.css = style
  HomePage.afterDOMLoaded = script
  return HomePage
}) satisfies QuartzComponentConstructor
