import React, { useState } from 'react';
import { ChecklistItem } from '../lib/dailyChecklistTypes.ts';
import { isDoneOn, createChecklistTask, toggleChecklistDone } from '../lib/dailyChecklistApi.ts';

interface Props {
  token: string;
  dateIso: string;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  onUnauthorized: () => void;
}

export default function ChecklistPanel({ token, dateIso, items, onItemsChange, onUnauthorized }: Props) {
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (item: ChecklistItem) => {
    try {
      const updated = await toggleChecklistDone(token, item.id, dateIso);
      onItemsChange(items.map(i => (i.id === updated.id ? updated : i)));
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setError('Could not update task. Try again.');
    }
  };

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    setError(null);
    try {
      const created = await createChecklistTask(token, text);
      onItemsChange([...items, created]);
      setNewText('');
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setError('Could not add task. Try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="daily-panel checklist-panel">
      <h2 className="daily-panel-title">Checklist</h2>
      {error && <p className="daily-panel-error">{error}</p>}
      <ul className="checklist-items">
        {items.map(item => (
          <li key={item.id} className="checklist-item">
            <label>
              <input
                type="checkbox"
                checked={isDoneOn(item, dateIso)}
                onChange={() => handleToggle(item)}
              />
              <span className={isDoneOn(item, dateIso) ? 'checklist-item-done' : ''}>{item.text}</span>
            </label>
          </li>
        ))}
        {items.length === 0 && <li className="checklist-empty">Nothing on the list yet.</li>}
      </ul>
      <div className="checklist-add-row">
        <input
          type="text"
          placeholder="Add a recurring task…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button type="button" disabled={adding || !newText.trim()} onClick={handleAdd}>
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </div>
    </section>
  );
}
