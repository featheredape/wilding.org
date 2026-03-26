import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    sortDate: z.string(),
    year: z.number(),
    tag: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    externalUrl: z.string().optional(),
  }),
});

const workshops = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/workshops" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    date: z.string().optional(),
    time: z.string().optional(),
    spots: z.number().optional(),
    classSize: z.number().optional(),
    cost: z.string().optional(),
    originalCost: z.string().optional(),
    startDate: z.string().optional(),
    duration: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    featured: z.boolean().optional(),
    hasApplicationForm: z.boolean().optional(),
    externalUrl: z.string().optional(),
  }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/newsletters" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    sortDate: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { news, workshops, newsletters };
