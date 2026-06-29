import Link from "next/link";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function ReportsFormsPage() {
  const { profile, supabase } = await requireWorkspaceProfile();
  const [reportsResult, documentsResult, candidatesResult, rolesResult] =
    await Promise.all([
      supabase
        .from("mentor_reports")
        .select("id, candidate_id, role_id, version, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_source_documents")
        .select("id, candidate_id, file_name, document_category, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidates")
        .select("id, full_name")
        .eq("organization_id", profile.organization_id),
      supabase
        .from("roles")
        .select("id, title")
        .eq("organization_id", profile.organization_id),
    ]);

  for (const result of [
    reportsResult,
    documentsResult,
    candidatesResult,
    rolesResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const candidateMap = new Map(
    (candidatesResult.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const roleMap = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));

  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Resources
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
            Generated resources, reports, and supporting documents
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            This is the central library for role and candidate paperwork. Today it
            surfaces generated mentor reports and uploaded source files, and it is
            now the home for growing interview resources such as behavioral
            question guides, interview scorecards, and other role-based packets.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Generated Mentor Reports
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {reportsResult.data?.length ?? 0}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Uploaded Source Documents
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {documentsResult.data?.length ?? 0}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Planned Next
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              Nomination forms and interview packets
            </p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Generated Reports
                </p>
                <h2 className="mt-3 font-display text-3xl text-slate-900">
                  Mentor report activity
                </h2>
              </div>
              <Link
                href="/candidates"
                className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Candidates
              </Link>
            </div>

            <div className="mt-6 grid gap-3">
              {(reportsResult.data ?? []).length > 0 ? (
                (reportsResult.data ?? []).slice(0, 8).map((report) => (
                  <article
                    key={report.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
                  >
                    <p className="font-semibold text-slate-900">
                      {candidateMap.get(report.candidate_id)?.full_name ??
                        "Unknown candidate"}
                    </p>
                    <p className="mt-2 leading-7">
                      Role: {roleMap.get(report.role_id)?.title ?? "Unknown role"}
                    </p>
                    <p className="text-slate-600">
                      Version {report.version} generated on{" "}
                      {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </article>
                ))
              ) : (
                <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  No mentor reports have been generated yet. Once you upload
                  candidate strengths and open a candidate detail page, you can
                  generate the first mentor report from there.
                </article>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Uploaded Forms and Files
            </p>
            <div className="mt-6 grid gap-3 text-sm leading-7 text-[#24512f]">
              {(documentsResult.data ?? []).length > 0 ? (
                (documentsResult.data ?? []).slice(0, 8).map((document) => (
                  <article
                    key={document.id}
                    className="emerald-soft-surface rounded-2xl border px-4 py-4"
                  >
                    <p className="font-semibold text-[#14361d]">{document.file_name}</p>
                    <p className="mt-2">
                      Candidate:{" "}
                      {candidateMap.get(document.candidate_id)?.full_name ??
                        "Unknown candidate"}
                    </p>
                    <p className="emerald-soft-surface-muted">
                      Category: {document.document_category}
                    </p>
                  </article>
                ))
              ) : (
                <article className="emerald-soft-surface rounded-2xl border px-4 py-4">
                  No candidate source documents are stored yet. Upload strengths or
                  supporting candidate files from the Candidates page.
                </article>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
