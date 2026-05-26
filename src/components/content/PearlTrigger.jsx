// === PearlTrigger (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// Inline trigger — renders a dotted-underline span that opens the lesson modal.
const PearlTrigger = ({ children, lesson, onOpen }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onOpen?.(lesson); }}
    title={lesson.title}
    style={{
      borderBottom: '1px dotted var(--ink-soft)',
      cursor: 'help',
      background: 'transparent',
      padding: 0,
      color: 'inherit',
      font: 'inherit',
      textAlign: 'left'
    }}
  >{children}</button>
);
