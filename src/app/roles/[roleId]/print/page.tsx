import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintCompositeActions } from "@/components/print-composite-actions";
import { PrintCompositePageClient } from "@/components/print-composite-page-client";
import { isAdminAppRole } from "@/lib/mentor-access";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import {
  extractRoleCompositeDocumentText,
  splitRoleCompositeNarrative,
} from "@/lib/role-composite-documents";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type PrintRoleCompositePageProps = {
  params: Promise<{
    roleId: string;
  }>;
};

function joinNarrativeList(items: string[], maxItems = 4) {
  const uniqueItems = Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean)),
  );

  if (uniqueItems.length === 0) {
    return "";
  }

  if (uniqueItems.length === 1) {
    return uniqueItems[0];
  }

  const visibleItems = uniqueItems.slice(0, maxItems);
  const remainingCount = uniqueItems.length - visibleItems.length;
  const itemsToJoin =
    remainingCount > 0
      ? [...visibleItems, `${remainingCount} more`]
      : visibleItems;

  if (itemsToJoin.length === 2) {
    return `${itemsToJoin[0]} and ${itemsToJoin[1]}`;
  }

  return `${itemsToJoin.slice(0, -1).join(", ")}, and ${itemsToJoin.at(-1)}`;
}

function joinNarrativeClauses(clauses: string[]) {
  if (clauses.length === 0) {
    return "";
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  if (clauses.length === 2) {
    return `${clauses[0]} and ${clauses[1]}`;
  }

  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}

function buildRoleNarrative(options: {
  roleTitle: string;
  roleDescription: string | null;
  idealCompetencies: {
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  roleCompetencies: Array<{
    name: string;
    definition: string;
  }>;
  assignedMentors: string[];
}) {
  const paragraphs: string[] = [];
  const trimmedDescription = options.roleDescription?.trim();

  if (trimmedDescription) {
    paragraphs.push(trimmedDescription);
  }

  const idealCompetencyClauses: string[] = [];

  if (options.idealCompetencies.talents.length > 0) {
    idealCompetencyClauses.push(
      `natural talents such as ${joinNarrativeList(options.idealCompetencies.talents)}`,
    );
  }

  if (options.idealCompetencies.skills.length > 0) {
    idealCompetencyClauses.push(
      `practical skills like ${joinNarrativeList(options.idealCompetencies.skills)}`,
    );
  }

  if (options.idealCompetencies.behaviors.length > 0) {
    idealCompetencyClauses.push(
      `observable behaviors including ${joinNarrativeList(options.idealCompetencies.behaviors)}`,
    );
  }

  if (idealCompetencyClauses.length > 0) {
    paragraphs.push(
      `The strongest profile for ${options.roleTitle} combines ${joinNarrativeClauses(idealCompetencyClauses)}.`,
    );
  }

  if (options.roleCompetencies.length > 0) {
    const competencyNames = options.roleCompetencies.map((competency) => competency.name);
    const competencyDefinitions = options.roleCompetencies
      .map((competency) => competency.definition?.trim())
      .filter(Boolean);

    paragraphs.push(
      `Success in this role shows up through ${joinNarrativeList(competencyNames, 5)}.`,
    );

    if (competencyDefinitions.length > 0) {
      paragraphs.push(
        competencyDefinitions
          .slice(0, 3)
          .join(" "),
      );
    }
  }

  if (options.assignedMentors.length > 0) {
    paragraphs.push(
      `Current mentor alignment for this role includes ${joinNarrativeList(options.assignedMentors, 3)}.`,
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      `A printable narrative has not been generated for ${options.roleTitle} yet.`,
    );
  }

  return paragraphs;
}

export default async function PrintRoleCompositePage({
  params,
}: PrintRoleCompositePageProps) {
  const { roleId } = await params;
  const { profile, supabase } = await requirePaidWorkspaceProfile();

  if (!isAdminAppRole(profile.role)) {
    redirect(
      "/candidates?message=Role+composites+are+available+to+organization+administrators+only",
    );
  }

  const [
    roleResult,
    characteristicsResult,
    competenciesResult,
    compositeDocumentResult,
    assignmentsResult,
    mentorsResult,
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id, title, department, description, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", roleId)
      .maybeSingle(),
    supabase
      .from("role_candidate_characteristics")
      .select("category, characteristic, sort_order")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("role_competencies")
      .select(
        "id, name, definition, weight, target_score, behavioral_indicators, red_flags",
      )
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .order("created_at", { ascending: true }),
    supabase
      .from("role_composite_documents")
      .select("file_name, storage_bucket, storage_path")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .maybeSingle(),
    supabase
      .from("role_mentor_assignments")
      .select("mentor_profile_id, status")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId),
    supabase
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", profile.organization_id)
      .eq("role", "mentor"),
  ]);

  if (
    roleResult.error ||
    characteristicsResult.error ||
    competenciesResult.error ||
    compositeDocumentResult.error
  ) {
    throw new Error(
      roleResult.error?.message ??
        characteristicsResult.error?.message ??
        competenciesResult.error?.message ??
        compositeDocumentResult.error?.message ??
        "Unable to load the printable role narrative.",
    );
  }

  if (assignmentsResult.error || mentorsResult.error) {
    throw new Error(
      assignmentsResult.error?.message ??
        mentorsResult.error?.message ??
        "Unable to load mentor assignments.",
    );
  }

  if (!roleResult.data) {
    notFound();
  }

  const role = roleResult.data;
  const characteristics = groupCharacteristicsByCategory(
    characteristicsResult.data ?? [],
  );
  let compositeNarrativeParagraphs: string[] = [];

  if (compositeDocumentResult.data?.storage_bucket && compositeDocumentResult.data.storage_path) {
    const storageResult = await supabase.storage
      .from(compositeDocumentResult.data.storage_bucket)
      .download(compositeDocumentResult.data.storage_path);

    if (!storageResult.error) {
      const compositeBuffer = Buffer.from(await storageResult.data.arrayBuffer());
      const extractedCompositeText = await extractRoleCompositeDocumentText({
        buffer: compositeBuffer,
        fileName: compositeDocumentResult.data.file_name ?? "role-composite.docx",
      });
      compositeNarrativeParagraphs = splitRoleCompositeNarrative(extractedCompositeText);
    } else {
      console.error("Unable to load stored role composite document for printable narrative", {
        roleId,
        storagePath: compositeDocumentResult.data.storage_path,
        error: storageResult.error,
      });
    }
  }
  const mentorMap = new Map(
    (mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const assignedMentors = Array.from(
    new Set(
      (assignmentsResult.data ?? [])
        .filter((assignment) => assignment.status === "active")
        .flatMap((assignment) => {
          const mentor = mentorMap.get(assignment.mentor_profile_id);

          if (!mentor) {
            return [];
          }

          return [
            mentor.position_title
              ? `${mentor.full_name} • ${mentor.position_title}`
              : mentor.full_name,
          ];
        }),
    ),
  );
  const fallbackNarrativeParagraphs = buildRoleNarrative({
    roleTitle: role.title,
    roleDescription: role.description,
    idealCompetencies: characteristics,
    roleCompetencies: (competenciesResult.data ?? []).map((competency) => ({
      name: competency.name,
      definition: competency.definition,
    })),
    assignedMentors,
  });
  const narrativeParagraphs =
    compositeNarrativeParagraphs.length > 0
      ? compositeNarrativeParagraphs
      : fallbackNarrativeParagraphs;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <PrintCompositePageClient />
      <div className="mx-auto max-w-5xl px-8 py-10 print:px-0 print:py-0">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Printable Role Narrative
            </p>
            <h1 className="mt-2 font-display text-3xl text-slate-900">
              {role.title}
            </h1>
          </div>
          <div className="flex gap-3">
            <PrintCompositeActions />
            <Link
              href={`/roles?mode=view&roleId=${role.id}`}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Roles
            </Link>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] print:rounded-none print:border-none print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {role.department || "Role Narrative"}
              </p>
              <h2 className="mt-3 font-display text-5xl leading-tight text-slate-900">
                {role.title}
              </h2>
              {role.description ? (
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">
                  {role.description}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Assigned mentors:{" "}
                <span className="font-semibold text-slate-900">
                  {assignedMentors.length > 0
                    ? assignedMentors.join(", ")
                    : "None yet"}
                </span>
              </p>
            </div>
            <div className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
              {role.status}
            </div>
          </div>

          <section className="mt-8">
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Role Narrative
            </p>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700">
              {narrativeParagraphs.map((paragraph, index) => (
                <p
                  key={`${role.id}-narrative-${index}`}
                  className={index === 0 ? "" : "mt-4"}
                >
                  {paragraph}
                </p>
              ))}
            </div>
            {compositeNarrativeParagraphs.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                No stored Word narrative was found for this role yet, so this
                printable version is being built from the saved role model and
                competencies.
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
