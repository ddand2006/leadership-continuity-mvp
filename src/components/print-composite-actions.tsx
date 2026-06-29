"use client";

export function PrintCompositeActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
    >
      Print Now
    </button>
  );
}
