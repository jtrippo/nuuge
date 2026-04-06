export default function NuugeWaxSeal({ size = 48 }: { size?: number }) {
  const id = `wax-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="42%" cy="38%" r="58%">
          <stop offset="0%" stopColor="#5AAE7E" />
          <stop offset="55%" stopColor="#3A7D5C" />
          <stop offset="100%" stopColor="#264D3A" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD4A0" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#3A7D5C" stopOpacity="0" />
          <stop offset="100%" stopColor="#162E22" stopOpacity="0.45" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-12%" y="-8%" width="124%" height="128%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodColor="#162E22" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Wax body — smooth circle with highlight gradient */}
      <circle cx="24" cy="24" r="23" fill={`url(#${id}-body)`} filter={`url(#${id}-shadow)`} />

      {/* Beveled rim — light on top edge, dark on bottom */}
      <circle cx="24" cy="24" r="21.5" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="2.5" />

      {/* Embossed ring — shadow offset below, highlight offset above */}
      <circle cx="24" cy="24.6" r="15.5" fill="none" stroke="#1B3F2D" strokeWidth="1" opacity="0.3" />
      <circle cx="24" cy="23.6" r="15.5" fill="none" stroke="#6CC48E" strokeWidth="0.7" opacity="0.25" />
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="#2E6349" strokeWidth="0.5" opacity="0.15" />

      {/* Embossed N — shadow beneath, highlight above, creates pressed-in look */}
      <text x="24.4" y="31.4" textAnchor="middle" fill="#1B3F2D" fontSize="20" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" opacity="0.35">N</text>
      <text x="23.6" y="30.2" textAnchor="middle" fill="#7DD4A0" fontSize="20" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" opacity="0.2">N</text>
      <text x="24" y="30.8" textAnchor="middle" fill="#D0EDDA" fontSize="20" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" opacity="0.85">N</text>
    </svg>
  );
}
