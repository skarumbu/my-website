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
});
