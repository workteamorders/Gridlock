'use client';

import { useEffect, useState } from 'react';

let previous: string | undefined;

export function RouteWipe() {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const path = location.pathname;
    if (previous !== undefined && previous !== path) setRun(true);
    previous = path;
  }, []);
  return run ? <span className="finish-wipe" aria-hidden="true" onAnimationEnd={() => setRun(false)} /> : null;
}
