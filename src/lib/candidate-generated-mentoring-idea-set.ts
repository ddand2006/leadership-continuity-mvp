import { z } from "zod";
import { generatedCandidateMentoringIdeasSchema } from "@/lib/candidate-mentoring-ideas";

const candidateGeneratedMentoringIdeaSetRowSchema = z.object({
  competency_id: z.string().uuid(),
  ideas_json: generatedCandidateMentoringIdeasSchema.shape.ideas,
  selected_idea_title: z.string().nullable().optional(),
  selected_project_assignment_id: z.string().uuid().nullable().optional(),
  selected_development_record_id: z.string().uuid().nullable().optional(),
  generated_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type CandidateGeneratedMentoringIdeaSetRow = z.infer<
  typeof candidateGeneratedMentoringIdeaSetRowSchema
>;

export function parseCandidateGeneratedMentoringIdeaSetRow(
  row: CandidateGeneratedMentoringIdeaSetRow,
) {
  return candidateGeneratedMentoringIdeaSetRowSchema.parse(row);
}

export function isMissingCandidateGeneratedMentoringIdeaSetTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("candidate_generated_mentoring_idea_sets") &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist")),
  );
}
