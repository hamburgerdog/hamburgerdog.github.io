import { defineConfig } from 'astro/config';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkToc from 'remark-toc';

import { rehypeHeadingIds } from '@astrojs/markdown-remark';

// https://astro.build/config
export default defineConfig({
	site: 'https://hamburgerdog.github.io',
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
});
