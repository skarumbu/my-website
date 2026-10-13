// Wikipedia's own "Today's Featured Article" (TFA) — editor-curated, not
// Special:Random, so it's never a stub or a non-notable topic. The REST
// endpoint is keyed by calendar date (UTC) and CORS-enabled for direct
// browser use; no backend involvement needed, it already returns the same
// article all day and a new one at UTC midnight on its own.

export interface FeaturedArticle {
  title: string;
  extract: string;
  url: string;
}

function todayUtcPath(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

export async function fetchFeaturedArticle(): Promise<FeaturedArticle> {
  const datePath = todayUtcPath();
  const cacheKey = `wiki-featured-${datePath}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // corrupt cache entry — fall through and refetch
    }
  }

  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${datePath}`);
  if (!res.ok) throw new Error(`Wikipedia featured-article feed returned ${res.status}`);
  const json = await res.json();
  const tfa = json.tfa;
  if (!tfa) throw new Error('No featured article in today’s feed');

  const article: FeaturedArticle = {
    title: tfa.titles?.normalized ?? tfa.title ?? 'Today’s featured article',
    extract: tfa.extract ?? '',
    url: tfa.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(tfa.title ?? '')}`,
  };

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(article));
  } catch {
    // sessionStorage unavailable (private mode, quota) — not fatal, just refetches next time
  }
  return article;
}
