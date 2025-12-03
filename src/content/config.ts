import { defineCollection, z } from 'astro:content';

// 2. Define a `type` and `schema` for each collection
const blogCollection = defineCollection({
  type: 'content', // v2.5.0 and later
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.string(),
    subtitle: z.optional(z.string()),
    remark: z.optional(z.string()),
  }),
});

// 3. Export a single `collections` object to register your collection(s)
export const collections = {
  blog: blogCollection,
};
