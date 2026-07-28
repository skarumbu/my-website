import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PackageDetail from './PackageDetail';

describe('PackageDetail history', () => {
  it('links the newest dashboard-api commit to its GitHub repo (which uses an underscore, unlike the hyphenated package key)', () => {
    render(<PackageDetail packageKey="dashboard-api" onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Change history/));
    const link = screen.getByText('b7176d7').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/skarumbu/dashboard_api/commit/b7176d7');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('toggles a "View changes" diff for a history entry', () => {
    render(<PackageDetail packageKey="dashboard-api" onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Change history/));
    const toggles = screen.getAllByText('View changes');
    fireEvent.click(toggles[0]);
    expect(screen.getByText('Hide changes')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide changes'));
    expect(screen.queryByText('Hide changes')).not.toBeInTheDocument();
  });
});
