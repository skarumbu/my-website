import React from 'react';
import { Block, BlockStyle, FONT_OPTIONS, STICKER_EMOJIS } from '../lib/diaryTypes.ts';

interface Props {
  block: Block;
  onChange: (block: Block) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function updateStyle(block: Block, style: Partial<BlockStyle>): Block {
  return { ...block, style: { ...block.style, ...style } };
}

function BlockEditorRow({ block, onChange, onMoveUp, onMoveDown, onDelete, isFirst, isLast }: Props) {
  return (
    <div className="block-editor-row" style={{ transform: `rotate(${block.style.rotation ?? 0}deg)` }}>
      <div className="block-editor-controls">
        <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label="Move block up">↑</button>
        <button type="button" onClick={onMoveDown} disabled={isLast} aria-label="Move block down">↓</button>
        <button type="button" onClick={onDelete} aria-label="Delete block">✕</button>
      </div>

      {block.type === 'text' && (
        <div className="block-editor-text">
          <textarea
            className="block-editor-textarea"
            placeholder="Write something…"
            value={block.content}
            style={{ fontFamily: block.style.font, color: block.style.color }}
            onChange={e => onChange({ ...block, content: e.target.value })}
          />
          <div className="block-editor-style-row">
            <label>
              Font
              <select
                value={block.style.font ?? ''}
                onChange={e => onChange(updateStyle(block, { font: e.target.value || undefined }))}
              >
                <option value="">Default</option>
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>
              Color
              <input
                type="color"
                value={block.style.color ?? '#333333'}
                onChange={e => onChange(updateStyle(block, { color: e.target.value }))}
              />
            </label>
            <label>
              Tilt
              <input
                type="range"
                min={-15}
                max={15}
                value={block.style.rotation ?? 0}
                onChange={e => onChange(updateStyle(block, { rotation: Number(e.target.value) }))}
              />
            </label>
          </div>
        </div>
      )}

      {block.type === 'sticker' && (
        <div className="block-editor-sticker">
          <select
            className="block-editor-emoji-select"
            value={block.emoji}
            onChange={e => onChange({ ...block, emoji: e.target.value })}
          >
            {STICKER_EMOJIS.map(emoji => <option key={emoji} value={emoji}>{emoji}</option>)}
          </select>
          <div className="block-editor-style-row">
            <label>
              Background
              <input
                type="color"
                value={block.style.background ?? '#fff8e1'}
                onChange={e => onChange(updateStyle(block, { background: e.target.value }))}
              />
            </label>
            <label>
              Tilt
              <input
                type="range"
                min={-15}
                max={15}
                value={block.style.rotation ?? 0}
                onChange={e => onChange(updateStyle(block, { rotation: Number(e.target.value) }))}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlockEditorRow;
