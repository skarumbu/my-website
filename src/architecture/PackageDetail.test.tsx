import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PackageDetail from './PackageDetail';

describe('PackageDetail history', () => {
  it('links the newest dashboard-api commit to its GitHub repo (which uses an underscore, unlike the hyphenated package key)', () => {
    render(<PackageDetail packageKey="dashboard-api" onBack={() => {}} onSelectTopic={() => {}} />);
    fireEvent.click(screen.getByText(/Change history/));
    const link = screen.getByText('b7176d7').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/skarumbu/dashboard_api/commit/b7176d7');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('PackageDetail related topics', () => {
  it('shows a Related Topics chip for a package referenced by the seeded "authentication" topic, and navigates on click', () => {
    const onSelectTopic = jest.fn();
    render(<PackageDetail packageKey="posts-api" onBack={() => {}} onSelectTopic={onSelectTopic} />);
    const chip = screen.getByRole('button', { name: 'Authentication' });
    fireEvent.click(chip);
    expect(onSelectTopic).toHaveBeenCalledWith('authentication');
  });

  it('does not render a Related Topics section for a package no topic references', () => {
    render(<PackageDetail packageKey="digits" onBack={() => {}} onSelectTopic={() => {}} />);
    expect(screen.queryByText('Related Topics')).not.toBeInTheDocument();
  });
});
