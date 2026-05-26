// === StarterProductPreview (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// Renders one of the starter product previews based on its `style` key. Each style
// is a small SVG composition with brand-evocative geometry + accent color.
// (Legacy — no longer wired into the cover lineup, kept for potential reuse.)
const StarterProductPreview = ({ style, src, alt = '' }) => {
  if (style === 'photo' && src) {
    return <img src={src} alt={alt} className="h-full w-auto max-w-full object-contain" style={{mixBlendMode:'multiply'}} />;
  }
  if (style === 'sk2') {
    // Clear glass bottle, frosted, red SK-II label.
    return (
      <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="0" width="6" height="3" rx="0.5" fill="#9c9080" />
        <rect x="11" y="3" width="10" height="5" rx="1" fill="#bdb6a8" />
        <path d="M7 12 Q 7 9, 10 9 L 22 9 Q 25 9, 25 12 L 25 60 Q 25 63, 22 63 L 10 63 Q 7 63, 7 60 Z" fill="#f5f0e8" stroke="#d4cfc3" strokeWidth="0.4" />
        <rect x="9" y="22" width="14" height="22" fill="#fbf7ee" opacity="0.85" />
        <text x="16" y="34" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#c2362e" fontFamily="sans-serif">SK-II</text>
        <text x="16" y="40" textAnchor="middle" fontSize="2.2" fill="#786a5e" fontFamily="sans-serif">PITERA</text>
      </svg>
    );
  }
  if (style === 'rejuran') {
    // Silver/chrome pump bottle with teal accent.
    return (
      <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="0" width="6" height="6" rx="1" fill="#c9c2b6" />
        <rect x="11" y="6" width="10" height="4" rx="0.5" fill="#9c9080" />
        <rect x="14" y="2" width="4" height="4" rx="0.5" fill="#786a5e" />
        <path d="M8 14 Q 8 11, 11 11 L 21 11 Q 24 11, 24 14 L 24 60 Q 24 63, 21 63 L 11 63 Q 8 63, 8 60 Z" fill="#dcd6c8" stroke="#bdb6a8" strokeWidth="0.4" />
        <rect x="10" y="14" width="12" height="48" fill="url(#rejuran-shine)" opacity="0.5" />
        <defs>
          <linearGradient id="rejuran-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="28" r="2.5" fill="#7eb6b0" />
        <text x="16" y="40" textAnchor="middle" fontSize="3.5" fontWeight="700" fill="#3a3328" fontFamily="sans-serif">REJURAN</text>
      </svg>
    );
  }
  if (style === 'aestura') {
    // White cream tube with diagonal blue swoosh.
    return (
      <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="58" width="6" height="6" rx="0.5" fill="#bdb6a8" />
        <path d="M7 4 L 25 4 Q 26 4, 26 5 L 26 58 L 6 58 L 6 5 Q 6 4, 7 4 Z" fill="#fdfcf8" stroke="#d4cfc3" strokeWidth="0.4" />
        <path d="M6 42 L 26 32 L 26 50 L 6 58 Z" fill="#5e7eaa" opacity="0.85" />
        <text x="16" y="22" textAnchor="middle" fontSize="3.6" fontWeight="800" fill="#3a3328" fontFamily="sans-serif">AESTURA</text>
        <text x="16" y="29" textAnchor="middle" fontSize="2.5" fontWeight="700" fill="#5e7eaa" fontFamily="sans-serif">365</text>
      </svg>
    );
  }
  // Generic fallback
  return (
    <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="0" width="10" height="6" rx="1.5" fill="#bdb6a8" opacity="0.7"/>
      <rect x="6" y="6" width="20" height="56" rx="3" fill="#e8e2d4" opacity="0.85"/>
    </svg>
  );
};
