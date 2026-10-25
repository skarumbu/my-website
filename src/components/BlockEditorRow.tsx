import React, { useRef } from 'react';
import { Block, BlockStyle, FONT_OPTIONS, STICKER_EMOJIS } from '../lib/diaryTypes.ts';
import { useSpeechToText } from '../lib/useSpeechToText.ts';
import { useAutoGrow } from '../lib/useAutoGrow.ts';

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

// Appends a dictated phrase to existing content, adding a separating space
// only when one isn't already there (start of block, or right after a
// newline, shouldn't get a leading space).
function appendDictatedText(content: string, phrase: string): string {
  if (!phrase) return content;
  if (!content || /\s$/.test(content)) return content + phrase;
  return content + ' ' + phrase;
}

function BlockEditorRow({ block, onChange, onMoveUp, onMoveDown, onDelete, isFirst, isLast }: Props) {
  const handleFinalText = (phrase: string) => {
    if (block.type !== 'text') return;
    onChange({ ...block, content: appendDictatedText(block.content, phrase) });
  };
  const speech = useSpeechToText(handleFinalText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(textareaRef, block.type === 'text' ? block.content : '', block.style.font);

  const tilt = (
    <label className="block-editor-tilt" title="Tilt">
      <span aria-hidden="true">⤾</span>
      <input
        type="range"
        min={-15}
        max={15}
        aria-label="Tilt"
        value={block.style.rotation ?? 0}
        onChange={e => onChange(updateStyle(block, { rotation: Number(e.target.value) }))}
      />
    </label>
  );

  // The toolbar sits after the block's content so Tab goes from the text
  // straight into its controls; CSS floats it above the block and only shows
  // it while the block has focus (or mouse hover). Buttons swallow mousedown
  // so a click doesn't pull focus out of the textarea, which would hide the
  // toolbar mid-tap on browsers that don't focus buttons (iOS Safari).
  const keepFocus = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  };

  return (
    <div className="block-editor-row" style={{ transform: `rotate(${block.style.rotation ?? 0}deg)` }}>
      {block.type === 'text' && (
        <div className="block-editor-text">
          <textarea
            ref={textareaRef}
            className="block-editor-textarea"
            rows={2}
            placeholder="Write something…"
            value={block.content}
            style={{ fontFamily: block.style.font, color: block.style.color }}
            onChange={e => onChange({ ...block, content: e.target.value })}
          />
          {speech.isListening && speech.interimText && (
            <p className="block-editor-interim" aria-live="polite">{speech.interimText}</p>
          )}
          {speech.error && <p className="block-editor-speech-error">{speech.error}</p>}
        </div>
      )}

      {block.type === 'sticker' && (
        <div className="block-editor-sticker">
          <select
            className="block-editor-emoji-select"
            aria-label="Sticker"
            value={block.emoji}
            onChange={e => onChange({ ...block, emoji: e.target.value })}
          >
            {STICKER_EMOJIS.map(emoji => <option key={emoji} value={emoji}>{emoji}</option>)}
          </select>
        </div>
      )}

      <div className="block-editor-float" role="group" aria-label="Block options" onMouseDown={keepFocus}>
        {block.type === 'text' && (
          <>
            {speech.isSupported && (
              <>
                <button
                  type="button"
                  className={`block-editor-mic-btn${speech.isListening ? ' is-listening' : ''}`}
                  onClick={() => (speech.isListening ? speech.stop() : speech.start())}
                  aria-pressed={speech.isListening}
                  aria-label={speech.isListening ? 'Stop voice entry' : 'Start voice entry'}
                  title={speech.isListening ? 'Stop voice entry' : 'Dictate into this block'}
                >
                  {speech.isListening ? '⏹' : '🎤'}
                </button>
                <span className="block-editor-float-sep" aria-hidden="true" />
              </>
            )}
            <select
              aria-label="Font"
              value={block.style.font ?? ''}
              onChange={e => onChange(updateStyle(block, { font: e.target.value || undefined }))}
            >
              <option value="">Default</option>
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input
              type="color"
              aria-label="Color"
              title="Color"
              value={block.style.color ?? '#333333'}
              onChange={e => onChange(updateStyle(block, { color: e.target.value }))}
            />
          </>
        )}
        {block.type === 'sticker' && (
          <input
            type="color"
            aria-label="Background"
            title="Background"
            value={block.style.background ?? '#fff8e1'}
            onChange={e => onChange(updateStyle(block, { background: e.target.value }))}
          />
        )}
        {tilt}
        <span className="block-editor-float-sep" aria-hidden="true" />
        <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label="Move block up">↑</button>
        <button type="button" onClick={onMoveDown} disabled={isLast} aria-label="Move block down">↓</button>
        <button type="button" onClick={onDelete} aria-label="Delete block">✕</button>
      </div>
    </div>
  );
}

export default BlockEditorRow;
