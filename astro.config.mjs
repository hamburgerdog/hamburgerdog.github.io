import { defineConfig } from 'astro/config';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkToc from 'remark-toc';

import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://josiah1.com',

  markdown: {
    // 应用于 .md 和 .mdx 文件
    remarkPlugins: [[remarkToc, { heading: 'contents' }]],
    rehypePlugins: [
      rehypeAccessibleEmojis,
      rehypeSlug,
      rehypeHeadingIds,
      [rehypeAutolinkHeadings, { behavior: 'append' }],
    ],
  },

  integrations: [
    preact(),
    sitemap({
      // 确保 sitemap 包含所有页面
      // filter 函数可以排除不需要索引的页面
      filter: (page) => {
        // 包含所有页面，排除可能的错误页面或测试页面
        return true;
      },
      // 设置变更频率和优先级
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
});
