import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LinkedText from './LinkedText';

describe('LinkedText', () => {
  it('renders plain text with no markers unchanged', () => {
    render(<LinkedText text="No topic markers here." onSelectTopic={() => {}} />);
    expect(screen.getByText('No topic markers here.')).toBeInTheDocument();
  });

  it('renders a marker with display text as a clickable button using the display text', () => {
    const onSelectTopic = jest.fn();
    render(
      <LinkedText
        text="Uses [[authentication|Google auth]] validation."
        onSelectTopic={onSelectTopic}
      />
    );
    const button = screen.getByRole('button', { name: 'Google auth' });
    fireEvent.click(button);
    expect(onSelectTopic).toHaveBeenCalledWith('authentication');
  });

  it('falls back to the slug itself when no display text is given', () => {
    render(<LinkedText text="See [[authentication]] for details." onSelectTopic={() => {}} />);
    expect(screen.getByRole('button', { name: 'authentication' })).toBeInTheDocument();
  });

  it('handles multiple markers in the same string', () => {
    render(
      <LinkedText
        text="Uses [[authentication|auth]] and [[caching|a cache]]."
        onSelectTopic={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'auth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'a cache' })).toBeInTheDocument();
  });

  it('preserves surrounding text before and after a marker', () => {
    const { container } = render(
      <LinkedText text="Before [[authentication|auth]] after." onSelectTopic={() => {}} />
    );
    expect(container.textContent).toBe('Before auth after.');
  });
});
