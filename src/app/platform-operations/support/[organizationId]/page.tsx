import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function SupportWorkspacePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { profile } = await requireWorkspaceProfile();
  if (profile.role !== "system_admin") redirect("/dashboard");

  const { organizationId } = await params;
  const admin = createSupabaseAdminClient();
  const [organization, candidates, roles, users, reviews] = await Promise.all([
    admin.from("organizations").select("id, name, industry, manual_access_status, manual_access_note").eq("id", organizationId).maybeSingle(),
    admin.from("candidates").select("id, full_name, current_title, status").eq("organization_id", organizationId).is("deleted_at", null).order("full_name"),
    admin.from("roles").select("id, title, department, status").eq("organization_id", organizationId).is("deleted_at", null).order("title"),
    admin.from("organization_users").select("id, first_name, last_name, email, status, admin_role").eq("organization_id", organizationId).order("last_name"),
    admin.from("review_360_cycles").select("id, title, status, due_date").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(8),
  ]);

  if (organization.error || candidates.error || roles.error || users.error || reviews.error) {
    throw new Error(organization.error?.message ?? candidates.error?.message ?? roles.error?.message ?? users.error?.message ?? reviews.error?.message ?? "Unable to load support workspace.");
  }
  if (!organization.data) notFound();

  return (
    <main className="app-page">
      <div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12">
        <div className="rounded-[2rem] border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <p className="text-sm font-semibold tracking-[0.16em] uppercase">Audited support workspace</p>
          <h1 className="mt-2 font-display text-4xl">{organization.data.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7">You are viewing this organization as a platform support administrator. This view does not expose individual 360 responses; the normal group-level confidentiality protections remain in place.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/platform-operations" className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold">Return to platform operations</Link>
            <Link href={`/administration?organizationId=${organizationId}`} className="interactive-contrast rounded-full bg-teal-950 px-4 py-2 text-sm font-semibold text-white">Open organization administration</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <section className="theme-panel-strong rounded-[1.75rem] p-6"><p className="text-sm font-semibold tracking-[0.14em] uppercase text-teal-700">People</p><p className="mt-3 font-display text-4xl">{users.data?.length ?? 0}</p><p className="mt-2 text-sm text-slate-600">{users.data?.filter((user) => user.status === "active").length ?? 0} active</p></section>
          <section className="theme-panel-strong rounded-[1.75rem] p-6"><p className="text-sm font-semibold tracking-[0.14em] uppercase text-teal-700">Candidates</p><p className="mt-3 font-display text-4xl">{candidates.data?.length ?? 0}</p></section>
          <section className="theme-panel-strong rounded-[1.75rem] p-6"><p className="text-sm font-semibold tracking-[0.14em] uppercase text-teal-700">Access</p><p className="mt-3 font-display text-3xl">{organization.data.manual_access_status === "payment_hold" ? "On hold" : "Active"}</p></section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="theme-panel-strong rounded-[1.75rem] p-6"><h2 className="font-display text-3xl">Candidates</h2><div className="mt-4 space-y-3">{candidates.data?.map((candidate) => <div key={candidate.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold">{candidate.full_name}</p><p className="text-sm text-slate-600">{candidate.current_title ?? "No current title"} · {candidate.status}</p></div>)}</div></section>
          <section className="theme-panel-strong rounded-[1.75rem] p-6"><h2 className="font-display text-3xl">Roles & 360 cycles</h2><div className="mt-4 space-y-3">{roles.data?.map((role) => <div key={role.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold">{role.title}</p><p className="text-sm text-slate-600">{role.department ?? "No department"} · {role.status}</p></div>)}{reviews.data?.map((review) => <div key={review.id} className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="font-semibold">360: {review.title}</p><p className="text-sm text-slate-600">{review.status} · due {review.due_date ?? "not set"}</p></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}
