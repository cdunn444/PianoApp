import { useEffect, useState } from 'react';

function isPortraitPhone(): boolean {
  return window.innerHeight > window.innerWidth && window.innerWidth < 700;
}

/** Shown over the player when a phone is held upright: the staff needs the width. */
export function RotateOverlay() {
  const [portrait, setPortrait] = useState(isPortraitPhone);
  useEffect(() => {
    const on = () => setPortrait(isPortraitPhone());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  if (!portrait) return null;
  return (
    <div className="rotate-overlay">
      <div className="rotate-icon">📱</div>
      <h2>Turn your phone sideways</h2>
      <p>The music needs the wide view.</p>
    </div>
  );
}
