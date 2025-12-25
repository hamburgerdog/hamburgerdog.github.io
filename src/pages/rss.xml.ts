import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

/**
 * RSS Feed API 路由
 * 返回符合 RSS 2.0 标准的 XML feed
 */
export const GET: APIRoute = async () => {
  // 获取所有博客文章
  const blogPosts = await getCollection('blog');

  // 按日期排序（最新的在前）
  const sortedPosts = blogPosts.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  const site = 'https://josiah1.com';

  // 生成 RSS items
  const items = sortedPosts.map((post) => ({
    title: post.data.title,
    link: `${site}/blog/${post.slug}`,
    pubDate: new Date(post.data.date),
    description: post.data.remark || post.data.subtitle || post.data.title,
    categories: post.data.tags ? post.data.tags.split(' ').filter(Boolean) : [],
  }));

  // 使用 @astrojs/rss 生成 RSS feed
  const rssResponse = await rss({
    title: "Josiah Hong's Blog",
    description: '技术分享与生活记录 - Technology sharing and life records',
    site: site,
    items: items,
    customData: `<language>zh-CN</language>
    <managingEditor>Josiah Hong</managingEditor>
    <webMaster>Josiah Hong</webMaster>`,
  });

  return rssResponse;
};

