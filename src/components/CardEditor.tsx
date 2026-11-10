import React, { useEffect, useRef, useState } from 'react';
import { IndexCard } from '../lib/dailyCardsTypes.ts';

export type EditorTarget = { kind: 'new' } | { kind: 'edit'; card: IndexCard };

interface Props {
  target: EditorTarget;
  onSave: (front: string, back: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  error: string | null;
  busy: boolean;
}

type Side = 'front' | 'back';

export default function CardEditor({ target, onSave, onDelete, onClose, error, busy }: Props) {
  const initial = target.kind === 'edit' ? target.card : null;
  const [front, setFront] = useState(initial?.text ?? '');
  const [back, setBack] = useState(initial?.back ?? '');
  const [side, setSide] = useState<Side>('front');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const canSave = front.trim() !== '' && !busy;

  useEffect(() => {
    areaRef.current?.focus();
  }, [side]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (confirmingDelete) setConfirmingDelete(false);
      else onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSave) onSave(front.trim(), back.trim());
    }
  };

  return (
    <div
      className="cp-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="cp-editor" role="dialog" aria-modal="true" aria-label={target.kind === 'new' ? 'New card' : 'Edit card'}>
        <div className="cp-toggle" role="group" aria-label="Card side">
          {(['front', 'back'] as Side[]).map(s => (
            <button
              key={s}
              type="button"
              className={side === s ? 'cp-toggle-on' : ''}
              aria-pressed={side === s}
              onClick={() => setSide(s)}
            >
              {s === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
        <div className="cp-stack">
          <div className="cp-layer cp-layer-2" aria-hidden="true" />
          <div className="cp-layer cp-layer-1" aria-hidden="true" />
          <div className="cp-notecard cp-notecard-large">
            <textarea
              ref={areaRef}
              className="cp-textarea"
              aria-label={side === 'front' ? 'Front text' : 'Back text'}
              placeholder={side === 'front' ? 'Something you learned, or a question…' : 'The answer…'}
              value={side === 'front' ? front : back}
              onChange={e => (side === 'front' ? setFront(e.target.value) : setBack(e.target.value))}
            />
          </div>
        </div>
        {error && <p className="cp-error" role="alert">{error}</p>}
        <div className="cp-actions">
          <button type="button" className="cp-save" disabled={!canSave} onClick={() => onSave(front.trim(), back.trim())}>
            Save
          </button>
          <button type="button" className="cp-cancel" onClick={onClose}>Cancel</button>
          {target.kind === 'edit' && (
            confirmingDelete ? (
              <span className="cp-delete-confirm">
                <span>Delete this card?</span>
                <button type="button" className="cp-delete-yes" disabled={busy} onClick={onDelete}>Delete</button>
                <button type="button" className="cp-link" autoFocus onClick={() => setConfirmingDelete(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="cp-link cp-delete-link" onClick={() => setConfirmingDelete(true)}>
                Delete card
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
