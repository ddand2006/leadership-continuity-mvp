export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl animate-pulse space-y-8">
        <div className="h-32 rounded-[2rem] border border-slate-200 bg-white" />
        <div className="space-y-3">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-10 w-96 max-w-full rounded bg-slate-200" />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="h-36 rounded-3xl border border-slate-200 bg-white" />
          <div className="h-36 rounded-3xl border border-slate-200 bg-white" />
          <div className="h-36 rounded-3xl border border-slate-200 bg-white" />
        </div>
        <div className="h-80 rounded-3xl border border-slate-200 bg-white" />
      </div>
    </main>
  );
}
