type WorkflowNoticeInput = {
  characteristics: Array<{ updated_at?: string; created_at?: string }>;
  composite?: { created_at?: string; storage_path?: string | null } | null;
  printablesStale?: boolean;
};

export function getRoleWorkflowNotices({ characteristics, composite, printablesStale = false }: WorkflowNoticeInput) {
  const missingCompetencies = characteristics.length === 0;
  const uploadTimestamp = Number(composite?.storage_path?.split("/").at(-1)?.match(/^(\d{13})-/)?.[1]) || 0;
  const compositeTimestamp = Math.max(uploadTimestamp, Date.parse(composite?.created_at ?? "") || 0);
  const competenciesChanged = Boolean(composite) && characteristics.some((item) =>
    Math.max(Date.parse(item.updated_at ?? "") || 0, Date.parse(item.created_at ?? "") || 0) > compositeTimestamp,
  );

  return {
    competencies: null,
    composite: competenciesChanged
      ? "Competencies changed. Update the role composite before generating new printables."
      : "Upload a job description to improve mentoring focus.",
    printables: printablesStale
      ? "Update the role composite, then generate new printables."
      : null,
  };
}
