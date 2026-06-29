import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { syncRoleCharacteristicLibrary } from "@/lib/role-characteristic-library";
import { categorizeRoleCharacteristic } from "@/lib/role-characteristic-categorizer";
import { normalizeRoleCandidateCharacteristics } from "@/lib/role-characteristics-normalizer";

const payloadSchema = z.object({
  competency: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = payloadSchema.parse(await request.json());
    const categorized = await categorizeRoleCharacteristic(payload.competency);
    const normalized = await normalizeRoleCandidateCharacteristics([
      {
        category: categorized.category,
        characteristic: categorized.characteristic,
        sort_order: 0,
      },
    ]);
    const item = normalized[0];

    if (!item) {
      throw new ApiRouteError("Unable to categorize that competency.", 422);
    }

    await syncRoleCharacteristicLibrary({
      admin,
      organizationId: profile.organization_id,
      items: [item],
    });

    return NextResponse.json({
      item: {
        id: `categorized-${item.category}-${item.characteristic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        category: item.category,
        characteristic: item.characteristic,
      },
      message: `Filed as a ${item.category}.`,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected competency categorization failure.",
    );
  }
}
