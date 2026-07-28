import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TopicDetail from './TopicDetail';

describe('TopicDetail', () => {
  it('renders the seeded "authentication" topic with its sections and related packages', () => {
    render(
      <TopicDetail
        topicSlug="authentication"
        onBack={() => {}}
        onSelectPackage={() => {}}
        onSelectTopic={() => {}}
      />
    );
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Google ID token (application-level)')).toBeInTheDocument();
    expect(screen.getByText('Azure EasyAuth (platform-level)')).toBeInTheDocument();
  });

  it('navigates to a related package when its chip is clicked', () => {
    const onSelectPackage = jest.fn();
    render(
      <TopicDetail
        topicSlug="authentication"
        onBack={() => {}}
        onSelectPackage={onSelectPackage}
        onSelectTopic={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'posts-api' }));
    expect(onSelectPackage).toHaveBeenCalledWith('posts-api');
  });

  it('shows a "not found" state for an unknown topic slug', () => {
    render(
      <TopicDetail
        topicSlug="not-a-real-topic"
        onBack={() => {}}
        onSelectPackage={() => {}}
        onSelectTopic={() => {}}
      />
    );
    expect(screen.getByText(/Topic not found/)).toBeInTheDocument();
  });
});
