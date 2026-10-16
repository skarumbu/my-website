import React, { useEffect, useRef } from 'react';
import { IndexCard } from '../lib/dailyCardsTypes.ts';

export type SheetState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      front: string;
      back: string;
      backShown: boolean;
      added: IndexCard[];
      status: 'idle' | 'saving' | 'error';
    };

export type OpenSheet = Extract<SheetState, { kind: 'open' }>;

export const EMPTY_SHEET: OpenSheet = { kind: 'open', front: '', back: '', backShown: false, added: [], status: 'idle' };

interface Props {
  sheet: OpenSheet;
  onChange: (patch: Partial<Pick<OpenSheet, 'front' | 'back' | 'backShown'>>) => void;
  onSave: (andAnother: boolean) => void;
  onClose: () => void;
}

export default function NewCardSheet({ sheet, onChange, onSave, onClose }: Props) {
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);
  const canSave = sheet.front.trim() !== '' && sheet.status !== 'saving';

  // Runs on open and again after each "Save & add another", so the next card
  // can be typed straight away.
  useEffect(() => {
    frontRef.current?.focus();
  }, [sheet.added.length]);

  useEffect(() => {
    if (sheet.backShown) backRef.current?.focus();
  }, [sheet.backShown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSave) onSave(false);
    }
  };

  return (
    <div
      className="cards-sheet-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="cards-sheet" role="dialog" aria-modal="true" aria-labelledby="cards-sheet-title">
        <div className="cards-sheet-head">
          <h3 id="cards-sheet-title">New card</h3>
          <button type="button" className="cards-sheet-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label>
          Front
          <textarea
            ref={frontRef}
            rows={2}
            placeholder="Something you learned, or a question…"
            value={sheet.front}
            onChange={e => onChange({ front: e.target.value })}
          />
        </label>
        {sheet.backShown ? (
          <label>
            Back · shown when you flip
            <textarea
              ref={backRef}
              rows={2}
              placeholder="The answer…"
              value={sheet.back}
              onChange={e => onChange({ back: e.target.value })}
            />
          </label>
        ) : (
          <button type="button" className="cards-sheet-linkish" onClick={() => onChange({ backShown: true })}>
            + Add an answer (back of card)
          </button>
        )}
        {sheet.added.length > 0 && <span className="cards-sheet-added">✓ {sheet.added.length} added</span>}
        {sheet.status === 'error' && <p className="daily-panel-error cards-sheet-error">Could not save card. Try again.</p>}
        <div className="cards-sheet-actions">
          <button type="button" className="cards-sheet-ghost" disabled={!canSave} onClick={() => onSave(true)}>
            Save &amp; add another
          </button>
          <button type="button" className="cards-sheet-save" disabled={!canSave} onClick={() => onSave(false)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
