// === RegimenTechnique (Wave 3.2 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const RegimenTechnique = ({ onOpenLesson }) => {
  const techniqueLessons = LESSONS.filter(l => TECHNIQUE_LESSON_IDS.includes(l.id));
  return (
    <div>
      <div className="text-sm font-light mb-6 max-w-2xl" style={{color:'var(--ink-soft)'}}>
        How you apply matters as much as what you apply. The pearls below cover the techniques that turn a shelf of products into an actual routine.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {techniqueLessons.map(l => (
          <button key={l.id} onClick={() => onOpenLesson(l)} className="border p-6 text-left transition hover:border-[var(--ink)]" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[9px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)'}}>Technique</div>
              {l.evidenceGrade && (
                <div className="text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 border" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>Evidence {l.evidenceGrade}</div>
              )}
            </div>
            <h3 className="font-sans text-xl leading-tight" style={{color:'var(--ink)'}}>{l.title}</h3>
            <p className="text-sm font-light mt-2 leading-relaxed" style={{color:'var(--ink-soft)'}}>{l.excerpt}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
