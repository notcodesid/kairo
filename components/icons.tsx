import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Svg>
  );
}

export function ArrowDownLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M17 7 7 17" />
      <path d="M17 17H7V7" />
    </Svg>
  );
}

export function ArrowUpRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </Svg>
  );
}

export function ArrowLeftRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </Svg>
  );
}

export function ShieldPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-3Z" />
      <path d="M12 9v6M9 12h6" />
    </Svg>
  );
}

export function Shield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-3Z" />
      <path d="m9.2 12 1.9 1.9 3.7-3.8" />
    </Svg>
  );
}

export function ShieldCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function Lock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function Unlock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.8-1.2" />
    </Svg>
  );
}

export function KeyRound(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.18 21.18a2.4 2.4 0 0 0 3.42 0l6.61-6.61a7 7 0 1 0-2.12-2.12l-6.61 6.61a2.4 2.4 0 0 0-1.3 2.12Z" />
      <circle cx="16.5" cy="7.5" r=".75" />
    </Svg>
  );
}

export function QrCode(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M7 7h.01M18 7h.01M7 18h.01M18 18h.01" />
    </Svg>
  );
}

export function Copy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function Check(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m20 6-11 11-5-5" />
    </Svg>
  );
}

export function ExternalLink(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Svg>
  );
}

export function RefreshCw(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </Svg>
  );
}

export function Activity(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Svg>
  );
}

export function Info(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function ChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function Sparkles(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3 1.9 4.7L18.6 9.6l-3.7 3.6.9 5.1L12 16l-3.8 2.3.9-5.1-3.7-3.6 4.7-1.9L12 3Z" />
    </Svg>
  );
}

export function Wallet(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </Svg>
  );
}

export function X(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function Spinner({ size = 20, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="motion-safe:animate-spin"
      {...p}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Kairo wordmark glyph — a soft, overlapping arc. */
export function KairoMark({ size = 22, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
      <path
        d="M4 5c2.5 2.2 4.4 5.6 4.4 9.2 0 1.9-.5 3.6-1.3 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.55"
      />
      <path
        d="M12 4c2.9 2.6 4.7 6.4 4.7 10.5 0 1.7-.3 3.3-.9 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M20 5c-2.5 2.2-4.4 5.6-4.4 9.2 0 1.9.5 3.6 1.3 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.55"
      />
    </svg>
  );
}
