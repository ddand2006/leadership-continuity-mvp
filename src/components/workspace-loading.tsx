type WorkspaceLoadingProps = {
  label: string;
};

export function WorkspaceLoading({ label }: WorkspaceLoadingProps) {
  return (
    <main className="app-page" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="mt-4 h-11 w-80 max-w-full rounded bg-slate-200" />
          <div className="mt-5 h-5 max-w-3xl rounded bg-slate-100" />
          <div className="mt-3 h-5 w-2/3 max-w-xl rounded bg-slate-100" />
          <div className="mt-8 flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-11 w-36 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white" />
          <div className="h-96 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white" />
        </section>
      </div>
    </main>
  );
}
