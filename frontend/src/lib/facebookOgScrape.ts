/**
 * Facebook OG cache warming.
 *
 * Facebook does NOT discover URLs on its own. It only scrapes a URL's OG tags
 * when explicitly told to via the Graph API or Sharing Debugger. Without this,
 * Facebook shows the generic localroots.love fallback image for every share.
 *
 * Call warmFacebookOgCache() fire-and-forget after every save that changes
 * data backing a page with dynamic OG tags (gardener profiles, garden collections).
 *
 * Requires FACEBOOK_APP_ID + FACEBOOK_APP_SECRET env vars (free FB app).
 * Silent no-op when env vars are missing (dev/test).
 */

export async function warmFacebookOgCache(path: string): Promise<void> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return;

  const url = `https://www.localroots.love${path}`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/?id=${encodeURIComponent(url)}&scrape=true&access_token=${appId}|${appSecret}`,
      { method: 'POST' },
    );
    if (!res.ok) {
      console.warn(`[fb-og-scrape] ${res.status} for ${path}`);
    }
  } catch (err) {
    console.warn('[fb-og-scrape] failed:', err);
  }
}
