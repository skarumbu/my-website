// Mirrors posts-api's daily/links.py LinkDef dataclass shape exactly.

export interface DailyLinkConfig {
  id: string;
  label: string;
  url: string;
}
