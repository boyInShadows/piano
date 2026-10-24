'use client';

import { useEffect, useState } from 'react';

export function usePianoViewport(playArea, onStopAll) {
  const [viewport, setViewport] = useState({ width: 0, portrait: false, rotate: false, short: false, availableHeight: 900 });

  useEffect(() => {
    const portrait = matchMedia('(orientation: portrait)');
    const coarse = matchMedia('(pointer: coarse)');
    let previous;
    function measure() {
      const element = playArea.current;
      if (!element?.getClientRects().length) return;
      const visual = window.visualViewport;
      const main = element.closest('main');
      const bounds = element.getBoundingClientRect();
      const scale = bounds.width / element.offsetWidth || 1;
      const bottomSpace = parseFloat(getComputedStyle(main).marginBottom) + parseFloat(getComputedStyle(document.body).paddingBottom);
      const availableHeight = ((visual?.height ?? window.innerHeight) - bounds.top - window.scrollY) / scale - bottomSpace;
      const next = {
        width: window.innerWidth,
        portrait: portrait.matches,
        rotate: portrait.matches && coarse.matches && window.innerWidth < 600,
        short: matchMedia('(max-height: 600px) and (min-width: 500px)').matches,
        availableHeight: Math.floor(availableHeight),
      };
      if (!previous || Object.keys(next).some((key) => next[key] !== previous[key])) {
        onStopAll();
        previous = next;
        setViewport(next);
      }
    }
    const observer = new ResizeObserver(measure);
    observer.observe(playArea.current.closest('main'));
    observer.observe(playArea.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    portrait.addEventListener('change', measure);
    coarse.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      portrait.removeEventListener('change', measure);
      coarse.removeEventListener('change', measure);
    };
  }, [playArea, onStopAll]);

  return viewport;
}
