export type VersionSummary = {
  document_id: string;
  version_id: string;
  content_type: string;
  message?: string;
  author?: string;
  created_at: string;
};

export type DiffResult = {
  text_diff: string;
  attachment_changes: Array<{
    filename: string;
    status: 'added' | 'removed' | 'changed' | 'unchanged';
    before_url?: string;
    after_url?: string;
  }>;
};
