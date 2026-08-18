import Link from "next/link";

export default function AccountRequestReceivedPage() {
  return <main className="app-page"><div className="mx-auto max-w-3xl px-6 py-16 sm:px-10"><section className="theme-panel-strong rounded-[2rem] p-10"><p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">Account request received</p><h1 className="mt-3 font-display text-5xl text-slate-950">Thank you — our team will be in touch.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">We have saved your contact details and will contact you to discuss the right Leadership Continuity plan. Your workspace will be activated after that conversation.</p><Link href="/auth" className="interactive-contrast mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Return to sign in</Link></section></div></main>;
}
