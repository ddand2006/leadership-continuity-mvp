type WorkflowNoticeInput = {
  characteristics: Array<{ updated_at?: string; created_at?: string }>;
  composite?: { created_at?: string; storage_path?: string | null } | null;
};

export function getRoleWorkflowNotices({ characteristics, composite }: WorkflowNoticeInput) {
  return {
    competencies: null,
    composite: "Upload a job description to improve mentoring focus.",
  };
}
