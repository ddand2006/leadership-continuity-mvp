import Link from "next/link";
import { PersonalStrengthsUploadCard } from "@/components/personal-strengths-upload-card";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { StrengthsReferenceCard } from "@/components/strengths-reference-card";
import { formatFileSize } from "@/lib/candidate-source-documents";
import { loadPersonalDevelopmentStrengthsPageData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentStrengthsPage() {
  const {
    workspace,
    strengths,
    strengthReferences,
    sourceDocuments,
    readableDocumentCount,
  } = await loadPersonalDevelopmentStrengthsPageData();
  const topStrengthNames = strengths.slice(0, 5).map((strength) => strength.theme_name);
  const detailItems = [
    `Strengths imported: ${workspace.strengthsCount}`,
    `Source documents: ${workspace.sourceDocumentCount}`,
    `Role profile: ${workspace.roleProfile?.title ?? "Not started"}`,
    `Composite status: ${workspace.latestComposite?.status ?? "Not generated yet"}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="strengths"
        />

        {!workspace.migrationReady ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase">
              Personal Development Migration
            </p>
            <h2 className="mt-3 font-display text-3xl">
              Apply the Personal Development foundation migration first
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7">
              The strengths workspace is wired in code, but the Personal
              Development profile, source-document, and strengths tables still
              need to be created in Supabase before uploads can be stored.
            </p>
          </section>
        ) : !workspace.personalProfile ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              CliftonStrengths
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Save your role profile before uploading strengths
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This workspace needs the leader&apos;s Personal Development profile
              first so Gallup files have a place to live. Once your role profile is
              saved, this page can archive strengths documents and import the
              ranked themes directly into your workspace.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/personal-development/role"
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Role Profile
              </Link>
            </div>
          </section>
        ) : (
          <>
            <PersonalStrengthsUploadCard
              leaderName={workspace.profile.full_name}
              importedStrengthCount={workspace.strengthsCount}
              readableDocumentCount={readableDocumentCount}
              sourceDocumentCount={workspace.sourceDocumentCount}
              topStrengthNames={topStrengthNames}
            />

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Archived Files
                </p>
                <h2 className="mt-3 font-display text-3xl text-slate-900">
                  Keep the Gallup source documents in view
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  Every uploaded Gallup file stays attached to this workspace so
                  you can reimport later if a stronger text-based report becomes
                  available.
                </p>

                <div className="mt-6 grid gap-4">
                  {sourceDocuments.length > 0 ? (
                    sourceDocuments.map((document) => (
                      <article
                        key={document.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {document.file_name}
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
                            {(document.extracted_text ?? "").trim().length > 0
                              ? "Readable text"
                              : "Archive only"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600">
                          <p>
                            {document.file_extension?.toUpperCase() ?? "File"}{" "}
                            {document.file_size_bytes
                              ? `• ${formatFileSize(document.file_size_bytes)}`
                              : ""}
                          </p>
                          <p>
                            Added{" "}
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(new Date(document.created_at))}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                      No Gallup files are attached to this Personal Development
                      workspace yet.
                    </article>
                  )}
                </div>
              </section>

              {strengths.length > 0 ? (
                <StrengthsReferenceCard
                  strengths={strengths.slice(0, 10)}
                  references={strengthReferences}
                />
              ) : (
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Strengths Insight
                  </p>
                  <h2 className="mt-3 font-display text-3xl text-slate-900">
                    Import Gallup themes to unlock strengths-aware coaching
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                    Once ranked themes are on file, this workspace can carry them
                    forward into coaching, composite refreshes, and later growth
                    planning.
                  </p>
                </section>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
