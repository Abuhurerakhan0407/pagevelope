import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/builder/', '/dashboard/', '/publish/', '/review/', '/workspaces/'],
    },
    sitemap: 'https://pagevelope.com/sitemap.xml',
  };
}
