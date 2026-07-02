import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoPopover } from './InfoPopover';

describe('InfoPopover', () => {
  describe('rendering', () => {
    it('renders trigger button with "What\'s this?" text', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText("What's this?")).toBeInTheDocument();
    });

    it('renders with correct aria-label', () => {
      render(<InfoPopover title="Test Title">Content</InfoPopover>);

      expect(screen.getByLabelText('Learn about Test Title')).toBeInTheDocument();
    });

    it('does not show popover content initially', () => {
      render(<InfoPopover title="Test">Popover content</InfoPopover>);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('opens popover when trigger is clicked', () => {
      render(<InfoPopover title="Test Title">Popover content</InfoPopover>);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Popover content')).toBeInTheDocument();
    });

    it('closes popover when close button is clicked', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      // Open
      fireEvent.click(screen.getByLabelText('Learn about Test'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('toggles popover when trigger is clicked twice', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      const trigger = screen.getByLabelText('Learn about Test');

      // Open
      fireEvent.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close
      fireEvent.click(trigger);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes popover on Escape key', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      fireEvent.click(screen.getByLabelText('Learn about Test'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct aria attributes when closed', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('has correct aria attributes when open', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      fireEvent.click(screen.getByLabelText('Learn about Test'));

      expect(screen.getByLabelText('Learn about Test')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has accessible popover title', () => {
      render(<InfoPopover title="Test Title">Content</InfoPopover>);

      fireEvent.click(screen.getByRole('button'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'info-popover-title');
      expect(screen.getByText('Test Title')).toHaveAttribute('id', 'info-popover-title');
    });
  });

  describe('content', () => {
    it('renders string children', () => {
      render(<InfoPopover title="Test">Simple string content</InfoPopover>);

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Simple string content')).toBeInTheDocument();
    });

    it('renders ReactNode children', () => {
      render(
        <InfoPopover title="Test">
          <p>Paragraph one</p>
          <p>Paragraph two</p>
        </InfoPopover>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Paragraph one')).toBeInTheDocument();
      expect(screen.getByText('Paragraph two')).toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('applies bottom position by default', () => {
      render(<InfoPopover title="Test">Content</InfoPopover>);

      fireEvent.click(screen.getByRole('button'));

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('top-full');
    });

    it('applies specified position', () => {
      render(
        <InfoPopover title="Test" position="top">
          Content
        </InfoPopover>
      );

      fireEvent.click(screen.getByRole('button'));

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('bottom-full');
    });
  });
});
