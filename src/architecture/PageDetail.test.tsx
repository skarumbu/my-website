import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PageDetail from './PageDetail';

describe('PageDetail — package pages', () => {
  it('renders a package page with role, description, tech stack, and CI/CD', () => {
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    expect(screen.getByText('digits')).toBeInTheDocument();
    expect(screen.getByText('Generates and serves daily Digits puzzles')).toBeInTheDocument();
    expect(screen.getByText('Azure Functions v2')).toBeInTheDocument();
    expect(screen.getByText('CI / CD')).toBeInTheDocument();
  });

  it('links the newest dashboard-api commit to its GitHub repo (which uses an underscore, unlike the hyphenated package key)', () => {
    render(<PageDetail pageKey="dashboard-api" onBack={() => {}} onSelectPage={() => {}} />);
    fireEvent.click(screen.getByText(/Change history/));
    const link = screen.getByText('b7176d7').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/skarumbu/dashboard_api/commit/b7176d7');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows a Related Pages chip for a package referenced by the seeded "authentication" page, and navigates on click', () => {
    const onSelectPage = jest.fn();
    render(<PageDetail pageKey="posts-api" onBack={() => {}} onSelectPage={onSelectPage} />);
    const chip = screen.getByRole('button', { name: 'Authentication' });
    fireEvent.click(chip);
    expect(onSelectPage).toHaveBeenCalledWith('authentication');
  });

  it('does not render a Related Pages section for a package nothing references', () => {
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    expect(screen.queryByText('Related Pages')).not.toBeInTheDocument();
  });
});

describe('PageDetail — non-package (topic) pages', () => {
  it('renders the seeded "authentication" page with its sections, but no tech stack or CI/CD', () => {
    render(<PageDetail pageKey="authentication" onBack={() => {}} onSelectPage={() => {}} />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Google ID token (application-level)')).toBeInTheDocument();
    expect(screen.getByText('Azure EasyAuth (platform-level)')).toBeInTheDocument();
    expect(screen.queryByText('CI / CD')).not.toBeInTheDocument();
  });

  it('shows Related Pages chips (forward-declared) and navigates to a package on click', () => {
    const onSelectPage = jest.fn();
    render(<PageDetail pageKey="authentication" onBack={() => {}} onSelectPage={onSelectPage} />);
    fireEvent.click(screen.getByRole('button', { name: 'posts-api' }));
    expect(onSelectPage).toHaveBeenCalledWith('posts-api');
  });

  it('shows a "not found" state for an unknown page key', () => {
    render(<PageDetail pageKey="not-a-real-page" onBack={() => {}} onSelectPage={() => {}} />);
    expect(screen.getByText(/Page not found/)).toBeInTheDocument();
  });
});
