import { NextResponse } from "next/server";
import { createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";

function sumEstimatedCost(rows: Array<{ estimated_cost: number | string | null }>) {
  return Number(
    rows
      .reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0)
      .toFixed(6),
  );
}

export async function GET() {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const organizationId = profile.organization_id;
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
    return createApiErrorResponse(
      error,
      "Unexpected OpenAI cost summary failure.",
    );
  }
}
