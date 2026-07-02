import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
    });

    it('renders tooltip content', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text');
    });

    it('tooltip has correct role', () => {
      render(
        <Tooltip content="Help text">
          <span>Info</span>
        </Tooltip>
      );
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('positions', () => {
    it('renders top position by default', () => {
      render(
        <Tooltip content="Top tooltip">
          <button>Button</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('bottom-full');
    });

    it('renders bottom position', () => {
      render(
        <Tooltip content="Bottom tooltip" position="bottom">
          <button>Button</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('top-full');
    });

    it('renders left position', () => {
      render(
        <Tooltip content="Left tooltip" position="left">
          <button>Button</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('right-full');
    });

    it('renders right position', () => {
      render(
        <Tooltip content="Right tooltip" position="right">
          <button>Button</button>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('left-full');
    });
  });

  describe('customization', () => {
    it('accepts additional className', () => {
      const { container } = render(
        <Tooltip content="Tooltip" className="custom-wrapper">
          <span>Text</span>
        </Tooltip>
      );
      expect(container.firstChild).toHaveClass('custom-wrapper');
    });

    it('wrapper has group class for hover behavior', () => {
      const { container } = render(
        <Tooltip content="Tooltip">
          <span>Text</span>
        </Tooltip>
      );
      expect(container.firstChild).toHaveClass('group');
    });
  });

  describe('accessibility', () => {
    it('arrow is hidden from screen readers', () => {
      render(
        <Tooltip content="Tooltip">
          <span>Text</span>
        </Tooltip>
      );
      const hiddenArrow = document.querySelector('[aria-hidden="true"]');
      expect(hiddenArrow).toBeInTheDocument();
    });

    it('tooltip starts invisible', () => {
      render(
        <Tooltip content="Tooltip">
          <span>Text</span>
        </Tooltip>
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('invisible', 'opacity-0');
    });
  });
});
