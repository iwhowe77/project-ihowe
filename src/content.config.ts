import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const reading = defineCollection({
  loader: file('src/data/reading.yaml'),
  schema: z.object({
    title: z.string(),
    url: z.string().url(),
    author: z.string().optional(),
    finished: z.boolean().default(false),
    note: z.string().optional(),
    added: z.coerce.date().optional(),
  }),
});

export const collections = { reading };
