# Project Overview

## 项目定位

`xjosiah-space` 是 Josiah Hong 的个人博客站点，面向中文读者，兼顾技术文章、工程经验、生活思考和个人介绍。站点通过 Astro 生成静态页面，部署到 GitHub Pages，主域名配置为 `https://josiah1.com`。

## 技术栈

- Astro 5：页面、布局、内容集合和静态构建。
- Markdown Content Collections：博客正文位于 `src/content/blog/`。
- Preact：局部交互组件，例如滚动出现动画。
- Sass / Less：Astro 组件内样式和组件模块样式。
- remark / rehype：自动目录、标题 slug、标题锚点和 emoji 可访问性处理。
- GitHub Actions：`main` 分支推送后构建并发布到 GitHub Pages。

## 目录职责

| 路径 | 作用 |
| --- | --- |
| `AGENTS.md` | agent 入口说明，指向 `.agents/context/`。 |
| `.agents/context/` | 项目稳定上下文，包含目录说明和写作指南。 |
| `.github/workflows/deploy.yaml` | GitHub Pages 部署流水线，使用 pnpm 和 Node 22 构建。 |
| `.astro/` | Astro 生成的类型与缓存目录，不手动编辑。 |
| `.vscode/` | 本地编辑器配置，不作为业务逻辑来源。 |
| `dist/` | 构建产物，不手动编辑。 |
| `false/metadata-v1.3/` | 本地包管理相关元数据残留，当前不参与站点逻辑。 |
| `node_modules/` | 依赖安装目录，不手动编辑。 |
| `public/` | 原样复制到站点根路径的静态资源，如 favicon、manifest、robots、头像和验证文件。 |
| `script/image2webp.js` | 图片转 WebP 脚本，并尝试更新 Markdown 中的图片引用。 |
| `src/assets/` | 站点内可由 Astro 打包处理的图片和 SVG，通常按文章主题建子目录。 |
| `src/components/` | 可复用 UI 和交互组件，如导航、文章列表、最新文章、滚动动画。 |
| `src/content/config.ts` | Astro 内容集合 schema，定义博客 frontmatter 字段。 |
| `src/content/blog/` | 博客 Markdown 正文，是内容更新的主要入口。 |
| `src/content/page/` | 首页信息和联系方式等页面片段。 |
| `src/content/experience/` | 工作经历内容与配置。 |
| `src/layouts/` | 页面骨架和文章排版，集中处理 SEO、导航、文章样式和经历布局。 |
| `src/pages/` | Astro 路由页面：首页、博客列表、文章详情、技能树和 RSS。 |
| `src/script/` | 浏览器端脚本，如主题切换、博客筛选、分享海报生成。 |
| `astro.config.mjs` | Astro 配置，包含站点域名、Markdown 插件、Preact 和 sitemap。 |
| `package.json` | 项目脚本、依赖和 Volta Node 版本。 |
| `pnpm-lock.yaml` | pnpm 锁文件。 |
| `tsconfig.json` | Astro TypeScript 基础配置，开启 `strictNullChecks` 并允许 JS。 |
| `global.css` | 当前为空，样式主要在 Astro 组件内定义。 |

## 内容流

1. 新文章放入 `src/content/blog/<文章名>.md`。
2. frontmatter 必填 `title`、`date`、`tags`，可选 `subtitle`、`remark`。
3. `src/content/config.ts` 校验文章元数据。
4. `src/pages/blog/[title].astro` 通过内容集合生成文章详情页，并补充目录、分享入口、Article schema 和面包屑 schema。
5. `src/components/blogList.astro` 读取所有文章，按日期排序，并按 `tags` 生成筛选项。包含 `精选` 标签的文章进入精选区。
6. `src/pages/rss.xml.ts` 生成 RSS。

## 文章素材

`src/assets/` 下的子目录大多对应文章主题：

- `MCP/`：MCP 相关文章素材。
- `dify-rag/`：Dify RAG 文章截图。
- `labelman/`：标注工具、画布、WASM、性能优化相关素材。
- `write/`：写作方法文章素材。
- `os/`：操作系统文章素材。
- `ts-proto/`：ts-proto 文章素材。
- `useAsyncEffect/`：React useEffect 异步问题文章素材。
- `fillrule/`：Canvas 填充规则文章素材。
- `vcanvas/`、`vultr.assets/`、`annos/`、`soft/`、`mdHTML/`：对应历史文章主题素材。

Markdown 中通常使用类似 `../../assets/write/image0.webp` 的相对路径引用图片。新增图片时优先使用 WebP；如果先放入 PNG/JPG，可在确认 `cwebp` 可用后运行 `pnpm image2webp`。

## 页面与布局关系

- `src/layouts/BaseLayout.astro`：全站 HTML、导航、主题变量、SEO、Open Graph、canonical、结构化数据和主题脚本。
- `src/layouts/BlogLayout.astro`：文章正文宽度、标题层级、段落、列表、引用、代码块、表格和图片样式。
- `src/pages/index.astro`：首页，组合个人介绍、最新文章、经历和联系方式。
- `src/pages/blog/index.astro`：博客列表页。
- `src/pages/blog/[title].astro`：文章详情页，处理目录高亮、回到顶部和移动端分享。
- `src/pages/roadmap.astro`：技能树图片页。

## 常用改动位置

| 任务 | 优先修改 |
| --- | --- |
| 新增文章 | `src/content/blog/`，必要时新增 `src/assets/<topic>/` |
| 修改文章列表展示 | `src/components/blogList.astro` |
| 修改文章正文样式 | `src/layouts/BlogLayout.astro` |
| 修改全站 SEO、导航壳、主题变量 | `src/layouts/BaseLayout.astro` |
| 修改首页内容 | `src/pages/index.astro`、`src/content/page/`、`src/content/experience/` |
| 修改部署 | `.github/workflows/deploy.yaml` |
| 修改 Markdown 处理 | `astro.config.mjs` |

## 运行与验证

```bash
pnpm dev
pnpm build
pnpm preview
pnpm image2webp
```

修改内容集合、页面、布局或构建配置后，至少运行 `pnpm build`。只改文档时也可以运行 `pnpm build`，确认新增说明没有破坏 Astro 构建。

## 注意事项

- `date` 使用字符串，项目中常见格式为 `YYYY-MM-DD HH:mm:ss +0800`。
- `tags` 是空格分隔字符串，不是数组；`精选` 是一个特殊标签。
- 文章详情页目前用 `blog.slug` 生成路由，文件名会影响 URL。
- `BlogLayout` 和 `BaseLayout` 有全局样式，改动可能影响所有文章。
- 不要把构建产物、缓存、依赖目录和 `.DS_Store` 纳入业务改动。
