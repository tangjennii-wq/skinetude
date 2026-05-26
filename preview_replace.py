"""Embed product previews into the cover."""
import base64

PATH = "/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html"

with open("/tmp/eltamd.b64", "r") as f:
    b64 = f.read().strip()
eltamd_data_uri = f"data:image/jpeg;base64,{b64}"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# Add a STARTER_PRODUCT_PREVIEWS constant near the LESSONS array (module scope).
# Find the "const LESSONS = [" line and inject just BEFORE it.
LESSONS_ANCHOR = "const LESSONS = ["
idx = src.find(LESSONS_ANCHOR)
assert idx > 0, "LESSONS anchor not found"

CONST = '''// === STARTER PRODUCT PREVIEWS ===
// Used as the placeholder lineup in Today's Ritual when the user hasn't logged any
// products yet. One real product photo (EltaMD UV Clear) plus three stylized SVG
// bottle illustrations tuned to popular skincare classics. The shapes + accent colors
// nod to AESTURA Atobarrier, REJURAN Turnover Ampoule, and SK-II Facial Treatment
// Essence so the lineup reads like a curated routine rather than ghosted silhouettes.
const STARTER_PRODUCT_PREVIEWS = [
  {
    name: 'SK-II',
    style: 'sk2',
  },
  {
    name: 'REJURAN',
    style: 'rejuran',
  },
  {
    name: 'AESTURA',
    style: 'aestura',
  },
  {
    name: 'EltaMD',
    style: 'photo',
    src: 'ELTAMD_PLACEHOLDER',
  },
];

// Renders one of the starter product previews based on its `style` key. Each style
// is a small SVG composition with brand-evocative geometry + accent color.
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

'''

# Insert just before LESSONS
new_src = src[:idx] + CONST + src[idx:]

# Replace ELTAMD_PLACEHOLDER with the actual data URI
new_src = new_src.replace("'ELTAMD_PLACEHOLDER'", f"'{eltamd_data_uri}'")

# Now find the placeholder rendering in Today's Ritual and replace it.
# The placeholder block currently renders ghosted SVG silhouettes via {Array.from({ length: slotsToFill })...}.
# We want: when displayProducts.length === 0 (no real products), render the 4 starter previews instead.

OLD_LINEUP = '''                      {/* Product image lineup — uses real product photos when available;
                          otherwise renders a ghosted bottle silhouette as a graceful placeholder. */}
                      <div className="flex items-end gap-1 flex-shrink-0" style={{maxWidth:'160px'}}>
                        {displayProducts.map((p, i) => (
                          <div key={p.id} className="flex-shrink-0 w-9 h-16 flex items-end justify-center overflow-hidden">
                            {p.photo || p.photoPath ? (
                              <Photo item={p} alt={p.name} className="h-full w-auto max-w-full object-contain"
                                renderFallback={() => (
                                  <svg viewBox="0 0 32 64" className="h-full w-auto"><rect x="11" y="0" width="10" height="6" rx="1.5" fill="#bdb6a8"/><rect x="6" y="6" width="20" height="56" rx="3" fill="#e8e2d4"/></svg>
                                )}
                              />
                            ) : (
                              <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
                                <rect x="11" y="0" width="10" height="6" rx="1.5" fill="#bdb6a8" opacity="0.7"/>
                                <rect x="6" y="6" width="20" height="56" rx="3" fill="#e8e2d4" opacity="0.85"/>
                              </svg>
                            )}
                          </div>
                        ))}
                        {Array.from({ length: slotsToFill }).map((_, i) => (
                          <div key={`ph-${i}`} className="flex-shrink-0 w-9 h-16 flex items-end justify-center">
                            <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
                              <rect x="11" y="0" width="10" height="6" rx="1.5" fill="#d4cfc3" opacity="0.6"/>
                              <rect x="6" y="6" width="20" height="56" rx="3" fill="#ebe5d7" opacity="0.6"/>
                            </svg>
                          </div>
                        ))}
                      </div>'''

NEW_LINEUP = '''                      {/* Product image lineup — uses real product photos when the user has
                          their own shelf. When the shelf is empty we render the four starter
                          previews (SK-II, REJURAN, AESTURA, EltaMD) so the empty state reads
                          like a curated routine instead of ghosted silhouettes. */}
                      <div className="flex items-end gap-1 flex-shrink-0" style={{maxWidth:'168px'}}>
                        {displayProducts.length > 0 ? (
                          <>
                            {displayProducts.map((p) => (
                              <div key={p.id} className="flex-shrink-0 w-9 h-16 flex items-end justify-center overflow-hidden">
                                {p.photo || p.photoPath ? (
                                  <Photo item={p} alt={p.name} className="h-full w-auto max-w-full object-contain"
                                    renderFallback={() => (
                                      <svg viewBox="0 0 32 64" className="h-full w-auto"><rect x="11" y="0" width="10" height="6" rx="1.5" fill="#bdb6a8"/><rect x="6" y="6" width="20" height="56" rx="3" fill="#e8e2d4"/></svg>
                                    )}
                                  />
                                ) : (
                                  <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="11" y="0" width="10" height="6" rx="1.5" fill="#bdb6a8" opacity="0.7"/>
                                    <rect x="6" y="6" width="20" height="56" rx="3" fill="#e8e2d4" opacity="0.85"/>
                                  </svg>
                                )}
                              </div>
                            ))}
                            {Array.from({ length: slotsToFill }).map((_, i) => (
                              <div key={`ph-${i}`} className="flex-shrink-0 w-9 h-16 flex items-end justify-center">
                                <svg viewBox="0 0 32 64" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="11" y="0" width="10" height="6" rx="1.5" fill="#d4cfc3" opacity="0.6"/>
                                  <rect x="6" y="6" width="20" height="56" rx="3" fill="#ebe5d7" opacity="0.6"/>
                                </svg>
                              </div>
                            ))}
                          </>
                        ) : (
                          STARTER_PRODUCT_PREVIEWS.map((p, i) => (
                            <div key={`starter-${i}`} className="flex-shrink-0 w-9 h-16 flex items-end justify-center overflow-hidden">
                              <StarterProductPreview style={p.style} src={p.src} alt={p.name} />
                            </div>
                          ))
                        )}
                      </div>'''

assert OLD_LINEUP in new_src, "OLD_LINEUP not found"
new_src = new_src.replace(OLD_LINEUP, NEW_LINEUP)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_src)

print(f"OK — {len(src)} -> {len(new_src)} chars (delta {len(new_src) - len(src)})")
