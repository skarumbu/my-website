import React, { useRef, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAutoGrow } from './useAutoGrow.ts';

// jsdom does no layout, so scrollHeight is always 0. Drive it from the
// textarea's own value instead: 20px per line, standing in for the browser.
beforeAll(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) { return this.value.split('\n').length * 20; },
  });
});

afterAll(() => {
  delete (HTMLTextAreaElement.prototype as any).scrollHeight;
});

function Harness({ initial = '' }: { initial?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  useAutoGrow(ref, value);
  return <textarea aria-label="body" ref={ref} value={value} onChange={e => setValue(e.target.value)} />;
}

it('sizes the textarea to its scrollHeight on mount', () => {
  render(<Harness initial={'one\ntwo\nthree'} />);
  expect(screen.getByLabelText('body').style.height).toBe('60px');
});

it('grows and shrinks with the content as it changes', () => {
  render(<Harness initial="one" />);
  const textarea = screen.getByLabelText('body');
  expect(textarea.style.height).toBe('20px');

  fireEvent.change(textarea, { target: { value: 'one\ntwo\nthree\nfour' } });
  expect(textarea.style.height).toBe('80px');

  fireEvent.change(textarea, { target: { value: 'one\ntwo' } });
  expect(textarea.style.height).toBe('40px');
});

it('re-measures on window resize', () => {
  render(<Harness initial="one" />);
  const textarea = screen.getByLabelText('body');
  textarea.style.height = '5px';

  act(() => { window.dispatchEvent(new Event('resize')); });
  expect(textarea.style.height).toBe('20px');
});
