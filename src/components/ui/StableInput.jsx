// === StableInput (Fix 2 — May 2026) ===
// Hoisted out of BrandPicker.jsx (it was wedged there from an earlier
// extraction pass and incorrectly forced unrelated components to depend
// on BrandPicker loading first). Now lives in src/components/ui/ as a
// proper shared primitive. Identity-preserving uncontrolled input —
// see the original comment block for the mobile-keyboard rationale.

const StableInput = React.memo(function StableInput({
  value, onChange, resetKey, as = 'input',
  placeholder, className, style, type = 'text', rows,
  maxLength, autoFocus, disabled, inputMode, onBlur,
}) {
  const ref = React.useRef(null);
  // Re-seed only when resetKey changes (switching to a different record). The DOM
  // node retains user input across all other parent re-renders.
  React.useEffect(() => {
    if (ref.current && ref.current.value !== (value ?? '')) {
      ref.current.value = value ?? '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  const handleChange = (e) => { if (onChange) onChange(e.target.value); };
  const handleBlur = (e) => { if (onBlur) onBlur(e.target.value); };
  const props = {
    ref,
    defaultValue: value ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    placeholder,
    className,
    style,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    autoFocus,
    disabled,
    maxLength,
    inputMode,
  };
  if (as === 'textarea') return React.createElement('textarea', { ...props, rows: rows || 3 });
  return React.createElement('input', { ...props, type });
});
