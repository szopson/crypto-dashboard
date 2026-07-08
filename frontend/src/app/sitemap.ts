import { MetadataRoute } from "next";
import { listAllReports, listSectorSlugs } from "@/lib/reports";
import { listPosts } from "@/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradingcommandcenter.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/cockpit`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/research`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const sectors = await listSectorSlugs();
  const sectorRoutes: MetadataRoute.Sitemap = sectors.map((sector) => ({
    url: `${baseUrl}/research/${sector}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const reports = await listAllReports();
  const reportRoutes: MetadataRoute.Sitemap = reports.map((r) => ({
    url: `${baseUrl}/research/${r.sector_slug}/${r.slug}`,
    lastModified: r.date ? new Date(r.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const posts = await listPosts();
  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...sectorRoutes, ...reportRoutes, ...postRoutes];
}
