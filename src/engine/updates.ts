/**
 * Detect a newly deployed build. Vite gives the main script a content hash, so comparing the
 * script URL in a freshly fetched index.html with the one this page loaded tells us whether a
 * newer version is live. Checked on launch and whenever the app returns to the foreground.
 */
const listeners = new Set<(available: boolean) => void>();
let available = false;
let checking = false;

export function onUpdateAvailable(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  fn(available);
  return () => listeners.delete(fn);
}

function currentScript(): string | null {
  const s = Array.from(document.scripts).find((el) => el.src.includes('/assets/'));
  return s ? new URL(s.src).pathname : null;
}

export async function checkForUpdate(): Promise<boolean> {
  if (checking || available || !currentScript()) return available;
  checking = true;
  try {
    const url = `${import.meta.env.BASE_URL}index.html?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return available;
    const html = await res.text();
    const m = /<script[^>]+src="([^"]*\/assets\/[^"]+)"/.exec(html);
    if (!m) return available;
    const remote = new URL(m[1], location.href).pathname;
    if (remote !== currentScript()) {
      available = true;
      listeners.forEach((fn) => fn(true));
    }
  } catch {
    /* offline: try again next time */
  } finally {
    checking = false;
  }
  return available;
}

/** Reload to pick up the new build. Library data lives in IndexedDB and survives reloads. */
export function applyUpdate(): void {
  location.reload();
}

export function startUpdateChecks(): () => void {
  if (import.meta.env.DEV) return () => undefined;
  void checkForUpdate();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
