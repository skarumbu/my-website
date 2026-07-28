import historyIndex from '../architecture-history-index.json';

export type HistoryEntry = {
  type: 'package' | 'topic';
  key: string;
  capturedAt: string;
  commitSha: string;
  commitMessage: string;
  triggeringPackage?: string;
};

export const allHistory = historyIndex as HistoryEntry[];
