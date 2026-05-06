# Agent Context

这个目录用于保存 agent 理解本项目所需的稳定上下文，减少每次任务都从零检索的成本。

## 阅读顺序

1. `project-overview.md`：先了解站点类型、目录职责、内容流和常用命令。
2. `writing-guide.md`：涉及新增、编辑、润色博客文章时阅读。
3. 具体任务相关源码：只在上述文档无法覆盖时再检索。

## 当前项目判断

- 技术栈：Astro 5 静态站，局部使用 Preact，Markdown 内容集合承载博客文章。
- 内容类型：前端、后端、AI 工具、工程实践、生活思考和个人经历。
- 主要产物：`src/content/blog/*.md` 文章、`src/assets/**` 配图、Astro 页面与布局。

## 快速命令

```bash
pnpm dev
pnpm build
pnpm preview
pnpm image2webp
```

`pnpm image2webp` 会扫描 `src/assets` 下的图片并更新 Markdown 引用，运行前确认本地有 `cwebp`。
