import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BlockEditorRow from './BlockEditorRow.tsx';
import { Block } from '../lib/diaryTypes.ts';

const noop = () => {};

function renderRow(block: Block, onChange = jest.fn()) {
  render(
    <BlockEditorRow
      block={block}
      onChange={onChange}
      onMoveUp={noop}
      onMoveDown={noop}
      onDelete={noop}
      isFirst={false}
      isLast={false}
    />
  );
  return onChange;
}

const textBlock: Block = { type: 'text', content: 'Hello', style: {} };

afterEach(() => {
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
});

it('hides the mic button in browsers without the Web Speech API', () => {
  renderRow(textBlock);
  expect(screen.queryByRole('button', { name: /voice entry/i })).not.toBeInTheDocument();
});

describe('with Web Speech API support', () => {
  // Minimal fake SpeechRecognition — just enough surface for the hook to
  // drive: start()/stop(), and hooks for the test to fire onresult/onend.
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = jest.fn();
    stop = jest.fn(() => { this.onend?.(); });
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }

  beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    (window as any).SpeechRecognition = FakeSpeechRecognition;
  });

  it('starts listening on mic click and appends a final transcript to the block content', () => {
    const onChange = renderRow(textBlock);

    fireEvent.click(screen.getByRole('button', { name: /start voice entry/i }));
    const recognition = FakeSpeechRecognition.instances[0];
    expect(recognition.start).toHaveBeenCalledTimes(1);

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'dictated words' } }],
      });
    });

    expect(onChange).toHaveBeenCalledWith({ ...textBlock, content: 'Hello dictated words' });
  });

  it('stops listening on a second click', () => {
    renderRow(textBlock);
    fireEvent.click(screen.getByRole('button', { name: /start voice entry/i }));
    const recognition = FakeSpeechRecognition.instances[0];

    fireEvent.click(screen.getByRole('button', { name: /stop voice entry/i }));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it('shows interim (not-yet-final) words while listening', () => {
    renderRow(textBlock);
    fireEvent.click(screen.getByRole('button', { name: /start voice entry/i }));
    const recognition = FakeSpeechRecognition.instances[0];

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: 'still talking' } }],
      });
    });

    expect(screen.getByText('still talking')).toBeInTheDocument();
  });
});

it('sizes the paragraph textarea to fit its whole content', () => {
  const spy = jest.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(721);
  renderRow({ type: 'text', content: 'A long paragraph', style: {} });
  expect(screen.getByPlaceholderText(/write something/i).style.height).toBe('721px');
  spy.mockRestore();
});

it('puts every block control in one toolbar that Tab reaches straight after the text', () => {
  renderRow(textBlock);
  const toolbar = screen.getByRole('group', { name: /block options/i });
  for (const name of [/font/i, /color/i, /tilt/i, /move block up/i, /move block down/i, /delete block/i]) {
    expect(toolbar).toContainElement(screen.getByLabelText(name));
  }
  const textarea = screen.getByPlaceholderText(/write something/i);
  // DOM order is tab order here: nothing focusable sits between the
  // textarea and the toolbar's first control.
  const focusables = Array.from(document.querySelectorAll('textarea, select, input, button'));
  expect(focusables.indexOf(screen.getByLabelText(/font/i))).toBe(focusables.indexOf(textarea) + 1);
});

it('keeps a sticker block editable, with its controls in the same toolbar', () => {
  const sticker: Block = { type: 'sticker', emoji: '⭐', style: { rotation: 4, background: '#ffeeaa' } };
  const onChange = renderRow(sticker);
  expect(screen.getByLabelText(/sticker/i)).toHaveValue('⭐');
  const toolbar = screen.getByRole('group', { name: /block options/i });
  expect(toolbar).toContainElement(screen.getByLabelText(/background/i));
  expect(toolbar).toContainElement(screen.getByLabelText(/tilt/i));

  fireEvent.change(screen.getByLabelText(/sticker/i), { target: { value: '🌙' } });
  expect(onChange).toHaveBeenCalledWith({ ...sticker, emoji: '🌙' });
});
