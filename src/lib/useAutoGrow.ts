import { RefObject, useCallback, useEffect, useLayoutEffect } from 'react';

// Sizes a textarea to its content so it never scrolls internally. Collapsing
// to `auto` first lets scrollHeight shrink as well as grow; the window scroll
// position is put back afterwards because that momentary collapse can shorten
// the page and make the browser clamp the scroll while typing near the bottom.
function fitToContent(el: HTMLTextAreaElement) {
  const { scrollX, scrollY } = window;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
  if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY);
}

/**
 * Keeps a textarea exactly as tall as its content: on mount, whenever `value`
 * or `font` changes (typing, dictation, a draft or server load, a font
 * switch), on window resize, and once late-loading web fonts arrive.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement>, value: string, font?: string) {
  const fit = useCallback(() => {
    if (ref.current) fitToContent(ref.current);
  }, [ref]);

  useLayoutEffect(fit, [fit, value, font]);

  useEffect(() => {
    let active = true;
    const refit = () => { if (active) fit(); };
    window.addEventListener('resize', refit);
    // A web font arriving after first paint changes line wrapping, so the
    // height measured on mount goes stale. `ready` covers the initial load;
    // `loadingdone` covers a font first used later (e.g. picked in the menu).
    const fonts = document.fonts as FontFaceSet | undefined; // absent in jsdom
    fonts?.ready.then(refit);
    fonts?.addEventListener?.('loadingdone', refit);
    return () => {
      active = false;
      window.removeEventListener('resize', refit);
      fonts?.removeEventListener?.('loadingdone', refit);
    };
  }, [fit]);
}
