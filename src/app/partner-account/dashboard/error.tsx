"use client";
export default function PartnerError({reset}:{reset:()=>void}) {
 return <main className="app-page"><div className="mx-auto max-w-5xl px-6 py-12 sm:px-10"><section className="theme-panel space-y-4 p-6 sm:p-8"><h1 className="text-2xl font-semibold">Your partner account could not be loaded</h1><p role="alert">Try again. If the problem continues, contact Leadership Continuity.</p><button onClick={reset} className="interactive-contrast rounded-full bg-blue-700 px-5 py-3">Try again</button></section></div></main>;
}
