import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/topicRail.scss"
import { resolveRelative } from "../util/path"
import { buildRecentEntries, buildTopicEntries } from "./topicData"
import { Date } from "./Date"

export default ((userOpts?: any) => {
  const TopicRail: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
    const topicList = buildTopicEntries(allFiles).slice(0, 10)
    const recentList = buildRecentEntries(allFiles).slice(0, 4)

    return (
      <div class="topic-rail">
        <section class="rail-panel">
          <p class="rail-title">专题</p>
          <p class="rail-summary">扁平入口，直接进入专题页而不是目录树。</p>
          <ul class="topic-list">
            {topicList.map((topic) => (
              <li>
                <a class="topic-link" href={resolveRelative(fileData.slug!, topic.slug)}>
                  <span class="topic-name">{topic.title}</span>
                  <span class="topic-count">{topic.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section class="rail-panel">
          <p class="rail-title">最近更新</p>
          <ul class="mini-list">
            {recentList.map((item) => (
              <li>
                <a class="mini-item" href={resolveRelative(fileData.slug!, item.slug)}>
                  <span class="mini-title">{item.title}</span>
                  <span class="mini-meta">
                    {item.modified ? <Date date={item.modified} locale={cfg.locale} /> : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  TopicRail.css = style
  return TopicRail
}) satisfies QuartzComponentConstructor