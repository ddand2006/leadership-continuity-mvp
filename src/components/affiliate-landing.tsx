/* eslint-disable @next/next/no-img-element -- Partner logos use administrator-approved external HTTPS URLs. */
import Link from "next/link";
import type { AffiliateBranding } from "@/lib/affiliates";

export function AffiliateLanding({ branding: b, slug, preview = false }: { branding: AffiliateBranding; slug: string; preview?: boolean }) {
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    {preview && <p className="bg-amber-100 p-4 text-center font-semibold">Draft preview · Not published · Enrollment disabled</p>}
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">{b.logoUrl && <img src={b.logoUrl} alt="" className="h-14 max-w-48 object-contain" referrerPolicy="no-referrer" />}<strong className="text-xl">{b.displayName}</strong></div>
        <Link href="/auth" className="underline">Client sign in</Link>
      </header>
      <section className="py-20"><p className="mb-5 text-sm font-bold uppercase tracking-widest" style={{ color: b.color }}>Leadership Continuity · Partner program</p>
        <h1 className="max-w-4xl text-5xl font-semibold leading-tight">{b.headline}</h1>
        <p className="mt-7 max-w-3xl whitespace-pre-line text-lg leading-8 text-slate-600">{b.description}</p>
        {!preview && <Link href={`/auth?mode=signup&affiliate=${encodeURIComponent(slug)}`} className="mt-8 inline-block rounded-full bg-slate-950 px-7 py-4 font-semibold text-white">Create your organization</Link>}
      </section>
      <section className="grid gap-6 md:grid-cols-3">{[["1. Create your account", "Set up your secure administrator login and organization."], ["2. Choose your plan", "Review current pricing and pay securely through Stripe."], ["3. Prepare your team", "Work with Leadership Continuity on implementation and training."]].map(([title, text]) => <article key={title} className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</section>
      <footer className="mt-16 border-t pt-6 text-sm leading-7 text-slate-600"><p>Presented by {b.displayName}. Software and subscription services provided by Leadership Continuity.</p><p>This partner may receive compensation for your subscription.</p><a className="underline" href={`mailto:${b.contactEmail}`}>Contact {b.displayName}</a></footer>
    </div>
  </main>;
}
