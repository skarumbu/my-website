/**
 * Build a posts-api URL for a section-generic item route.
 * e.g. sectionUrl('writing') -> `${BASE_URL}/api/sections/writing/items`
 *      sectionUrl('writing', 'my-slug') -> `${BASE_URL}/api/sections/writing/items/my-slug`
 *
 * Reads REACT_APP_POSTS_API_BASE_URL at call time (not module load time) so
 * tests can set process.env before rendering.
 */
export function sectionUrl(section: string, slug?: string): string {
  const path = `/api/sections/${section}/items${slug ? `/${slug}` : ''}`;
  return `${process.env.REACT_APP_POSTS_API_BASE_URL}${path}`;
}

export function isApiConfigured(): boolean {
  return !!process.env.REACT_APP_POSTS_API_BASE_URL;
}
