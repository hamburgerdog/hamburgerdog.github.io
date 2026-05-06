# Agent Entry

这个仓库是 Josiah Hong 的个人博客与技术文章站点。开始修改前，先阅读 `.agents/context/README.md`，再按任务需要读取项目总览或写作指南。

优先入口：

- `.agents/context/project-overview.md`：项目结构、目录职责、运行命令和常见改动位置。
- `.agents/context/writing-guide.md`：博客文章的 frontmatter、结构、语气、排版和素材引用规范。

执行原则：

- 内容类改动优先放在 `src/content/blog/`，图片素材放在 `src/assets/<topic>/`。
- 站点结构和 SEO 默认由 `src/layouts/BaseLayout.astro`、`src/layouts/BlogLayout.astro` 与 `src/pages/blog/[title].astro` 处理。
- 不要手动修改 `dist/`、`.astro/`、`node_modules/` 或 `.DS_Store`。
- 改动完成后至少运行 `pnpm build` 验证 Astro 内容集合和静态构建。
