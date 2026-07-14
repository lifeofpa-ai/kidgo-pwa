import type { MetadataRoute } from "next";

const AI_CRAWLERS = [
    "GPTBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Amazonbot",
    "Applebot-Extended",
  ];

const ALLOWED = ["/", "/explore", "/events/"];
const DISALLOWED = [
    "/dashboard",
    "/ich",
    "/bookmarks",
    "/planer",
    "/badges",
    "/login",
    "/submit",
    "/admin",
    "/api/",
  ];

export default function robots(): MetadataRoute.Robots {
    return {
          rules: [
            {
                      userAgent: "*",
                      allow: ALLOWED,
                      disallow: DISALLOWED,
            },
            {
                      userAgent: AI_CRAWLERS,
                      allow: ALLOWED,
                      disallow: DISALLOWED,
            },
                ],
          sitemap: "https://app.kidgo.ch/sitemap.xml",
    };
}
