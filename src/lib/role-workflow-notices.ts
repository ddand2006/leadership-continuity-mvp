type WorkflowNoticeInput = {
  characteristics: Array<{ updated_at?: string; created_at?: string }>;
  composite?: { created_at?: string; storage_path?: string | null } | null;
};

export function getRoleWorkflowNotices({ characteristics, composite }: WorkflowNoticeInput) {
  const missingCompetencies = characteristics.length === 0;
  // Replacement composites keep the database row's original created_at.
  // The storage filename starts with the upload timestamp (see role-composite-documents).
  const uploadTimestamp = Number(composite?.storage_path?.split("/").at(-1)?.match(/^(\d{13})-/)?.[1]) || 0;
  const compositeTimestamp = Math.max(uploadTimestamp, Date.parse(composite?.created_at ?? "") || 0);
  const competenciesChanged = Boolean(composite) && characteristics.some((item) =>
    Math.max(Date.parse(item.updated_at ?? "") || 0, Date.parse(item.created_at ?? "") || 0) > compositeTimestamp,
  );

  return {
    competencies: missingCompetencies
      ? "No competencies added. Upload competencies or use the survey to get started."
      : competenciesChanged
        ? "Competencies have changed. Generate a new role composite."
        : null,
    composite: !composite
      ? missingCompetencies
        ? "Not generated. Add competencies first, then generate the role composite."
        : "Not generated. Generate the role composite."
      : missingCompetencies || competenciesChanged
        ? "Update needed. Review competencies and generate a new role composite."
        : null,
  };
}
