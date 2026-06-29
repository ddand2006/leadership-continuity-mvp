import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_ROLES = new Set(["system_admin", "hospital_admin"]);

function sumEstimatedCost(rows: Array<{ estimated_cost: number | string | null }>) {
  return Number(
    rows
      .reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0)
      .toFixed(6),
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const profileResult = await admin
      .from("profiles")
      .select("organization_id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileResult.error) {
      return NextResponse.json(
        { error: profileResult.error.message },
        { status: 500 },
      );
    }

    if (!profileResult.data) {
      return NextResponse.json(
        { error: "Initialize your workspace before viewing OpenAI cost data." },
        { status: 403 },
      );
    }

    if (!ADMIN_ROLES.has(profileResult.data.role)) {
      return NextResponse.json(
        { error: "Only admins can view OpenAI cost data." },
        { status: 403 },
      );
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const organizationId = profileResult.data.organization_id;
    const [reportsCountResult, allTimeUsageResult, currentMonthUsageResult] =
      await Promise.all([
        admin
          .from("mentor_reports")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        admin
          .from("openai_usage_logs")
          .select("estimated_cost, mentor_reports!inner(organization_id)")
          .eq("feature_name", "mentor_report")
          .eq("mentor_reports.organization_id", organizationId),
        admin
          .from("openai_usage_logs")
          .select("estimated_cost, mentor_reports!inner(organization_id)")
          .eq("feature_name", "mentor_report")
          .eq("mentor_reports.organization_id", organizationId)
          .gte("created_at", currentMonthStart.toISOString()),
      ]);

    for (const result of [
      reportsCountResult,
      allTimeUsageResult,
      currentMonthUsageResult,
    ]) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      totalCandidateReports: reportsCountResult.count ?? 0,
      estimatedSpendAllTime: sumEstimatedCost(allTimeUsageResult.data ?? []),
      estimatedSpendCurrentMonth: sumEstimatedCost(
        currentMonthUsageResult.data ?? [],
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected OpenAI cost summary failure.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
