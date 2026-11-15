import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "yhf.",
    pageTitleSuffix: " · yhf. 学习笔记",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "zh-CN",
    baseUrl: "heiferleaf.github.io/ObsidianNote",
    // Apply publication exclusions before parsing so every index agrees with the output.
    ignorePatterns: ["private", ".obsidian", "**/*练习*/**", "**/*作业*/**", "**/*.excalidraw.md"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Manrope",
        body: "Inter",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#f4f3ee",
          lightgray: "#dedfd6",
          gray: "#616f64",
          darkgray: "#3c4940",
          dark: "#222c28",
          secondary: "#355a43",
          tertiary: "#b74931",
          highlight: "rgba(89, 118, 83, 0.09)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#1c2420",
          lightgray: "#3b453e",
          gray: "#a0ada0",
          darkgray: "#ccd5c8",
          dark: "#e1e7dc",
          secondary: "#b0c9a5",
          tertiary: "#e6aa83",
          highlight: "rgba(153, 181, 138, 0.12)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
        sourceRoot: "..",
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts(), Plugin.HideAttachmentFiles()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: false, // 完全禁用 RSS 生成
        rssSlug: "", // 防止生成 index.xml
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
