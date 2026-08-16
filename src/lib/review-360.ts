import { createHash, randomBytes } from "crypto";
import { z } from "zod";

export const review360Relationships = ["self", "supervisor", "peer", "direct_report", "other"] as const;
export type Review360Relationship = (typeof review360Relationships)[number];

export const createReview360Schema = z.object({
  employeeRoleAssignmentId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  dueDate: z.string().date().optional(),
});

export const addReview360RespondentSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320), relationship: z.enum(review360Relationships),
});

export const submitReview360Schema = z.object({
  relationship: z.enum(review360Relationships),
  ratings: z.array(z.object({ questionId: z.string().uuid(), rating: z.number().int().min(1).max(5).nullable(), comment: z.string().trim().max(4000).optional() })).min(1),
  strength: z.string().trim().max(4000).optional(), development: z.string().trim().max(4000).optional(), additionalFeedback: z.string().trim().max(4000).optional(),
});

export function createReview360Token() { return randomBytes(32).toString("base64url"); }
export function hashReview360Token(token: string) { return createHash("sha256").update(token).digest("hex"); }

type Rating = { competencyId: string; relationship: Review360Relationship; rating: number | null; notObserved?: boolean; weight: number };
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function calculateReview360Results(ratings: Rating[], threshold = 3) {
  const byCompetency = new Map<string, Rating[]>();
  ratings.forEach((rating) => { if (!rating.notObserved && rating.rating !== null) byCompetency.set(rating.competencyId, [...(byCompetency.get(rating.competencyId) ?? []), rating]); });
  return [...byCompetency].map(([competencyId, values]) => {
    const group = (relationship: Review360Relationship) => values.filter((value) => value.relationship === relationship).map((value) => value.rating as number);
    const self = mean(group("self")); const supervisor = mean(group("supervisor"));
    const anonymous = ["peer", "direct_report", "other"] as const;
    const anonymousValues = anonymous.flatMap(group);
    const others = mean(values.filter((v) => v.relationship !== "self").map((v) => v.rating as number));
    const category = (relationship: typeof anonymous[number]) => { const scores = group(relationship); return scores.length >= threshold ? mean(scores) : null; };
    return { competencyId, self, supervisor, peer: category("peer"), directReport: category("direct_report"), other: category("other"), others, overall: mean(values.map((v) => v.rating as number)), validResponses: values.length, anonymousResponses: anonymousValues.length, selfOtherGap: self !== null && others !== null ? self - others : null, weightedDevelopmentPriority: others === null ? null : (5 - others) * values[0].weight };
  });
}
