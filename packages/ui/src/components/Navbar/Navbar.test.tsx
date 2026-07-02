import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  describe('rendering', () => {
    it('renders the brand name', () => {
      render(<Navbar />);
      expect(screen.getByText('FIREFLY NETWORK')).toBeInTheDocument();
    });

    it('renders custom brand name', () => {
      render(<Navbar brandName="EFECTO COCUYO" />);
      expect(screen.getByText('EFECTO COCUYO')).toBeInTheDocument();
    });

    it('renders firefly symbol', () => {
      render(<Navbar />);
      expect(screen.getAllByLabelText('Firefly').length).toBeGreaterThan(0);
    });

    it('renders default navigation links', () => {
      render(<Navbar />);
      expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Bounties' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
    });

    it('renders custom navigation links', () => {
      const customLinks = [
        { href: '/custom', label: 'Custom' },
        { href: '/other', label: 'Other' },
      ];
      render(<Navbar navLinks={customLinks} />);
      expect(screen.getByRole('link', { name: 'Custom' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Other' })).toBeInTheDocument();
    });
  });

  describe('slots', () => {
    it('renders wallet slot', () => {
      render(<Navbar walletSlot={<button>Connect Wallet</button>} />);
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    });

    it('renders actions slot', () => {
      render(<Navbar actionsSlot={<button>Theme Toggle</button>} />);
      expect(screen.getByRole('button', { name: 'Theme Toggle' })).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('marks current path as active', () => {
      render(<Navbar currentPath="/explore" />);
      const exploreLink = screen.getByRole('link', { name: 'Explore' });
      expect(exploreLink).toHaveAttribute('aria-current', 'page');
    });

    it('marks nested paths as active', () => {
      render(<Navbar currentPath="/explore/chain-001" />);
      const exploreLink = screen.getByRole('link', { name: 'Explore' });
      expect(exploreLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark other paths as active', () => {
      render(<Navbar currentPath="/explore" />);
      const aboutLink = screen.getByRole('link', { name: 'About' });
      expect(aboutLink).not.toHaveAttribute('aria-current');
    });
  });

  describe('mobile menu', () => {
    it('renders mobile menu button', () => {
      render(<Navbar />);
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('toggles mobile menu on click', () => {
      render(<Navbar />);
      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('shows mobile navigation when open', () => {
      render(<Navbar />);
      fireEvent.click(screen.getByLabelText('Open menu'));
      const mobileMenu = document.getElementById('mobile-menu');
      expect(mobileMenu).toBeInTheDocument();
    });

    it('renders Illuminate button in mobile menu', () => {
      render(<Navbar />);
      fireEvent.click(screen.getByLabelText('Open menu'));
      expect(screen.getByRole('button', { name: /Illuminate/i })).toBeInTheDocument();
    });

    it('calls onIlluminate when mobile Illuminate button is clicked', () => {
      const handleIlluminate = vi.fn();
      render(<Navbar onIlluminate={handleIlluminate} />);
      fireEvent.click(screen.getByLabelText('Open menu'));
      fireEvent.click(screen.getByRole('button', { name: /Illuminate/i }));
      expect(handleIlluminate).toHaveBeenCalledTimes(1);
    });

    it('renders custom illuminate label in mobile menu', () => {
      render(<Navbar illuminateLabel="Iluminar" />);
      fireEvent.click(screen.getByLabelText('Open menu'));
      expect(screen.getByRole('button', { name: /Iluminar/i })).toBeInTheDocument();
    });
  });

  describe('custom Link component', () => {
    it('uses custom Link component for navigation', () => {
      function CustomLink({
        href,
        children,
        ...props
      }: {
        href: string;
        children: React.ReactNode;
      }): React.ReactElement {
        return (
          <a href={href} data-custom="true" {...props}>
            {children}
          </a>
        );
      }
      render(<Navbar LinkComponent={CustomLink} />);
      const links = document.querySelectorAll('[data-custom="true"]');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has banner role', () => {
      render(<Navbar />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('has navigation role with label', () => {
      render(<Navbar />);
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    it('has home link with accessible label', () => {
      render(<Navbar homeLabel="Go to homepage" />);
      expect(screen.getByLabelText('Go to homepage')).toBeInTheDocument();
    });

    it('mobile menu button has aria-controls', () => {
      render(<Navbar />);
      expect(screen.getByLabelText('Open menu')).toHaveAttribute('aria-controls', 'mobile-menu');
    });
  });
});
