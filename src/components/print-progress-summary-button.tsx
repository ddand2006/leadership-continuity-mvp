"use client";

export function PrintProgressSummaryButton() {
  return <button type="button" onClick={() => window.print()} className="print:hidden rounded-full bg-teal-950 px-5 py-3 font-semibold text-white">Print progress summary</button>;
}
