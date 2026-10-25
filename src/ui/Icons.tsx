import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });

export const PlayIcon = (p: P) => (
  <svg {...base(p)}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>
);
export const PauseIcon = (p: P) => (
  <svg {...base(p)}><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></svg>
);
export const RestartIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v5h5" /></svg>
);
export const SpeakerIcon = ({ muted, ...p }: P & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 10v4h3l4 4V6L7 10z" fill="currentColor" stroke="none" />
    {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <><path d="M15 9.5a3.5 3.5 0 0 1 0 5" /><path d="M17.5 7a7 7 0 0 1 0 10" /></>}
  </svg>
);
export const ExitIcon = (p: P) => (
  <svg {...base(p)}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
);
export const ChevronUp = (p: P) => (
  <svg {...base(p)}><path d="M6 15l6-6 6 6" /></svg>
);
export const ArrowLeft = (p: P) => (
  <svg {...base(p)}><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></svg>
);
export const ArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
);
export const NoteIcon = (p: P) => (
  <svg {...base(p)}><path d="M9 18V5l10-2v13" /><circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" /><circle cx="16.5" cy="16" r="2.5" fill="currentColor" stroke="none" /></svg>
);
export const MetronomeIcon = (p: P) => (
  <svg {...base(p)}><path d="M9 3h6l3 18H6z" /><path d="M12 15L18 5" /><path d="M7 15h10" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const BackIcon = (p: P) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ShareIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
);
export const EditIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></svg>
);
export const LoopIcon = (p: P) => (
  <svg {...base(p)}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
);
