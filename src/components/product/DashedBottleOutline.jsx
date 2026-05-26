// === DashedBottleOutline (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// Default placeholder when no real product photo and no AI-generated art exists.
// === PRODUCT GLYPH (formerly DashedBottleOutline) ===
// May 2026: Jenni's "no more pill bottles, ever" directive — this
// component used to be a dashed bottle silhouette; now it renders the
// category-mapped Lucide icon (Shield / Leaf / Droplet / Sun / Zap /
// Sparkles…) the same icon vocabulary used on the Suggested-matches
// tiles, so the visual language stays consistent across the app.
// Name is kept as DashedBottleOutline so the 20+ existing call sites
// don't need to be touched — adding a `category` prop is opt-in.
// If you're updating a call site, pass `category={product?.category}`
// to get a specific icon; the default fallback is a neutral Circle.
const DashedBottleOutline = ({ category, size }) => {
  // Default to Sparkles (universal "product" glyph) when no category is
  // known. Sites with product context can pass `category={p?.category}`
  // for a specific Shield / Leaf / Droplet / Sun / Zap icon.
  const iconName = category ? getCategoryIcon(category) : 'Sparkles';
  return (
    <div className="h-full w-full flex items-center justify-center" style={{color:'#9c9080'}} aria-hidden>
      <Icon name={iconName} size={size || 20} strokeWidth={1.4} />
    </div>
  );
};
