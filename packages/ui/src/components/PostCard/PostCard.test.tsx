import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from './PostCard';
import type { PostPreview } from '@cocuyo/types';

const createMockPost = (overrides: Partial<PostPreview> = {}): PostPreview => ({
  id: 'post-123' as PostPreview['id'],
  excerpt: 'This is a test post excerpt for testing purposes.',
  topics: ['politics', 'local-news'],
  status: 'published',
  corroborationCount: 5,
  challengeCount: 2,
  createdAt: Date.now() - 3600000, // 1 hour ago
  ...overrides,
});

describe('PostCard', () => {
  describe('rendering', () => {
    it('renders as article element', () => {
      render(<PostCard post={createMockPost()} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('renders post excerpt', () => {
      const post = createMockPost({ excerpt: 'Test excerpt content' });
      render(<PostCard post={post} />);
      expect(screen.getByText('Test excerpt content')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      const post = createMockPost({ title: 'Test Title' });
      render(<PostCard post={post} />);
      expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
    });

    it('does not render title heading when not provided', () => {
      const post = createMockPost();
      render(<PostCard post={post} />);
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('renders topics', () => {
      const post = createMockPost({ topics: ['climate', 'environment'] });
      render(<PostCard post={post} />);
      expect(screen.getByText('climate')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
    });

    it('renders location when provided', () => {
      const post = createMockPost({ locationName: 'San Francisco' });
      render(<PostCard post={post} />);
      expect(screen.getByText('San Francisco')).toBeInTheDocument();
    });

    it('renders corroboration count', () => {
      const post = createMockPost({ corroborationCount: 10 });
      render(<PostCard post={post} />);
      expect(screen.getByText('10 corroborations')).toBeInTheDocument();
    });

    it('uses singular form for 1 corroboration', () => {
      const post = createMockPost({ corroborationCount: 1 });
      render(<PostCard post={post} />);
      expect(screen.getByText('1 corroboration')).toBeInTheDocument();
    });

    it('renders challenge count when > 0', () => {
      const post = createMockPost({ challengeCount: 3 });
      render(<PostCard post={post} />);
      expect(screen.getByText('3 challenges')).toBeInTheDocument();
    });

    it('uses singular form for 1 challenge', () => {
      const post = createMockPost({ challengeCount: 1 });
      render(<PostCard post={post} />);
      expect(screen.getByText('1 challenge')).toBeInTheDocument();
    });

    it('does not render challenge count when 0', () => {
      const post = createMockPost({ challengeCount: 0 });
      render(<PostCard post={post} />);
      expect(screen.queryByText(/challenge/)).not.toBeInTheDocument();
    });
  });

  describe('relative time formatting', () => {
    it('shows "just now" for very recent posts', () => {
      const post = createMockPost({ createdAt: Date.now() - 30000 }); // 30 seconds ago
      render(<PostCard post={post} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('shows minutes ago', () => {
      const post = createMockPost({ createdAt: Date.now() - 300000 }); // 5 minutes ago
      render(<PostCard post={post} />);
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('shows hours ago', () => {
      const post = createMockPost({ createdAt: Date.now() - 7200000 }); // 2 hours ago
      render(<PostCard post={post} />);
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('shows days ago', () => {
      const post = createMockPost({ createdAt: Date.now() - 172800000 }); // 2 days ago
      render(<PostCard post={post} />);
      expect(screen.getByText('2d ago')).toBeInTheDocument();
    });

    it('handles second timestamps (Unix)', () => {
      const post = createMockPost({ createdAt: Math.floor(Date.now() / 1000) - 3600 }); // 1 hour ago in seconds
      render(<PostCard post={post} />);
      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      const post = createMockPost();
      render(<PostCard post={post} onClick={onClick} />);

      // When clickable, the article has role="button"
      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledWith(post.id);
    });

    it('has button role when clickable', () => {
      render(<PostCard post={createMockPost()} onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('is not a button when not clickable', () => {
      render(<PostCard post={createMockPost()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles Enter key press', () => {
      const onClick = vi.fn();
      const post = createMockPost();
      render(<PostCard post={post} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith(post.id);
    });

    it('handles Space key press', () => {
      const onClick = vi.fn();
      const post = createMockPost();
      render(<PostCard post={post} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalledWith(post.id);
    });

    it('has tabIndex when clickable', () => {
      render(<PostCard post={createMockPost()} onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
    });
  });

  describe('translations', () => {
    it('uses custom translation strings', () => {
      const post = createMockPost({ corroborationCount: 1, challengeCount: 1 });
      render(
        <PostCard
          post={post}
          translations={{
            corroborationWord: 'bestätigung',
            corroborationsWord: 'bestätigungen',
            challengeWord: 'einwand',
            challengesWord: 'einwände',
            readMore: 'Mehr lesen',
          }}
        />
      );
      expect(screen.getByText('1 bestätigung')).toBeInTheDocument();
      expect(screen.getByText('1 einwand')).toBeInTheDocument();
    });

    it('uses topic translations', () => {
      const post = createMockPost({ topics: ['local-news'] });
      render(<PostCard post={post} topicTranslations={{ 'local-news': 'Lokale Nachrichten' }} />);
      expect(screen.getByText('Lokale Nachrichten')).toBeInTheDocument();
    });

    it('replaces hyphens with spaces when no topic translation', () => {
      const post = createMockPost({ topics: ['local-news'] });
      render(<PostCard post={post} />);
      expect(screen.getByText('local news')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label with title when provided', () => {
      const post = createMockPost({ title: 'My Post Title' });
      render(<PostCard post={post} onClick={vi.fn()} />);
      expect(screen.getByLabelText('Post: My Post Title')).toBeInTheDocument();
    });

    it('has generic aria-label when no title', () => {
      render(<PostCard post={createMockPost()} onClick={vi.fn()} />);
      expect(screen.getByLabelText('Post')).toBeInTheDocument();
    });

    it('stat icons are hidden from screen readers', () => {
      render(<PostCard post={createMockPost()} />);
      const hiddenIcons = document.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });
  });
});
