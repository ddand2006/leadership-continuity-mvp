"use client";

export function PrintOrganizationAwardActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full bg-teal-950 px-5 py-3 text-sm font-semibold text-white"
    >
      Print or save as PDF
    </button>
  );
}
