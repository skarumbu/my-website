// Mirrors posts-api's schema_diary.py block shape exactly — no transform
// layer needed between the API response and this UI state.

export interface BlockStyle {
  font?: string;
  color?: string;
  rotation?: number;
  background?: string;
}

export interface TextBlock {
  type: 'text';
  content: string;
  style: BlockStyle;
}

export interface StickerBlock {
  type: 'sticker';
  emoji: string;
  style: BlockStyle;
}

export type Block = TextBlock | StickerBlock;

export interface DiaryEntry {
  slug: string;
  title: string;
  date: string;
  updatedAt?: string;
  blocks: Block[];
}

export const FONT_OPTIONS = ['handwriting', 'typewriter', 'serif', 'sans'] as const;
export const STICKER_EMOJIS = ['🌻', '⭐', '❤️', '☕', '🌙', '✨', '📌', '🍀'] as const;
