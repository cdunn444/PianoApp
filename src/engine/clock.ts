/** One shared requestAnimationFrame loop. Subscribers get the current time each frame. */
type FrameFn = (now: number) => void;
const subs = new Set<FrameFn>();
let raf: number | null = null;

function tick(now: number) {
  subs.forEach((fn) => fn(now));
  raf = subs.size ? requestAnimationFrame(tick) : null;
}

export function subscribeFrame(fn: FrameFn): () => void {
  subs.add(fn);
  if (raf === null) raf = requestAnimationFrame(tick);
  return () => {
    subs.delete(fn);
  };
}
