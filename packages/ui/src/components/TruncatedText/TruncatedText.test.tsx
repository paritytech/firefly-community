import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TruncatedText } from './TruncatedText';

describe('TruncatedText', () => {
  const shortText = 'This is a short text.';
  const longText = 'A'.repeat(300); // 300 characters, exceeds default 280

  describe('rendering', () => {
    it('renders full text when under maxLength', () => {
      render(<TruncatedText text={shortText} />);
      expect(screen.getByText(shortText)).toBeInTheDocument();
    });

    it('does not show expand button when text is short', () => {
      render(<TruncatedText text={shortText} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('truncates text when over maxLength', () => {
      render(<TruncatedText text={longText} />);
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });

    it('shows "Read more" button when truncated', () => {
      render(<TruncatedText text={longText} />);
      expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
    });
  });

  describe('expansion', () => {
    it('expands text when "Read more" is clicked', () => {
      render(<TruncatedText text={longText} />);

      fireEvent.click(screen.getByRole('button', { name: 'Read more' }));

      expect(screen.getByText(longText)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Read less' })).toBeInTheDocument();
    });

    it('collapses text when "Read less" is clicked', () => {
      render(<TruncatedText text={longText} />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: 'Read more' }));
      // Collapse
      fireEvent.click(screen.getByRole('button', { name: 'Read less' }));

      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('respects custom maxLength', () => {
      const text = 'A'.repeat(50);
      render(<TruncatedText text={text} maxLength={20} />);

      // Should truncate since 50 > 20
      expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
    });

    it('does not truncate when maxLength exceeds text length', () => {
      render(<TruncatedText text={shortText} maxLength={1000} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('uses custom expand label', () => {
      render(<TruncatedText text={longText} expandLabel="Show more" />);
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    });

    it('uses custom collapse label', () => {
      render(<TruncatedText text={longText} collapseLabel="Show less" />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    });

    it('applies className to wrapper', () => {
      render(<TruncatedText text={shortText} className="custom-text" />);
      expect(screen.getByText(shortText)).toHaveClass('custom-text');
    });

    it('applies className when truncated', () => {
      render(<TruncatedText text={longText} className="custom-text" />);
      const wrapper = screen.getByText(/\.\.\./).closest('span');
      expect(wrapper).toHaveClass('custom-text');
    });
  });
});
