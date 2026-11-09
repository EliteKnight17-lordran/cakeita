import type { SVGProps } from 'react';

/** Small line icons (1.75px stroke, 24px grid). Decorative: hidden from screen readers. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4.5M12 17.5v.01" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></Svg>;
export const IconStop = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0113 0c0 4.9-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></Svg>;
export const IconChat = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1115.1 3.7L20 20l-4.3-.9A8 8 0 014 12z" /></Svg>;
export const IconCamera = (p: P) => <Svg {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></Svg>;
export const IconPrint = (p: P) => <Svg {...p}><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /></Svg>;
export const IconTruck = (p: P) => <Svg {...p}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></Svg>;
export const IconStore = (p: P) => <Svg {...p}><path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6" /></Svg>;
export const IconMic = (p: P) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></Svg>;
export const IconPen = (p: P) => <Svg {...p}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /></Svg>;
export const IconCalc = (p: P) => <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></Svg>;
export const IconWrench = (p: P) => <Svg {...p}><path d="M14.5 6.5a4 4 0 00-5.3 5.3L4 17v3h3l5.2-5.2a4 4 0 005.3-5.3l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z" /></Svg>;
export const IconArrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconHeart = (p: P) => <Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></Svg>;
export const IconUser = (p: P) => <Svg {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0115 0" /></Svg>;
export const IconMenu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const IconCloud = (p: P) => <Svg {...p}><path d="M7 18h10a4 4 0 00.6-8A6 6 0 006.2 11 3.5 3.5 0 007 18z" /></Svg>;
export const IconMail = (p: P) => <Svg {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" /></Svg>;
export const IconTurnLeft = (p: P) => <Svg {...p}><path d="M4 5v5h5" /><path d="M5 14a7.5 7.5 0 101.8-7.6L4 10" /></Svg>;
export const IconTurnRight = (p: P) => <Svg {...p}><path d="M20 5v5h-5" /><path d="M19 14a7.5 7.5 0 11-1.8-7.6L20 10" /></Svg>;
export const IconSlice = (p: P) => <Svg {...p}><path d="M3 15l17-7v8l-17 3z" /><path d="M3 15v4M3 15l17-7M20 12l-17 4" /><path d="M14 6.5c0-1.2.8-2 2-2" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></Svg>;
export const IconStar = (p: P & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return <Svg {...rest} fill={filled ? 'currentColor' : 'none'}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8L12 3.5z" /></Svg>;
};
