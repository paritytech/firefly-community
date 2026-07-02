/**
 * Tests for ProfileEditForm component.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- act from RTL is valid for React 18 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditForm } from './ProfileEditForm';
import { createDIMCredential, createFireflyId } from '@cocuyo/types';
import type { DisclosureLevel, FireflyProfile } from '@cocuyo/types';

/**
 * Create a mock FireflyProfile for testing.
 */
function createMockProfile(overrides: Partial<FireflyProfile> = {}): FireflyProfile {
  const credentialHash = createDIMCredential('dim-test-credential');
  return {
    id: createFireflyId('firefly-test'),
    credentialHash,
    pseudonym: 'TestUser',
    disclosureLevel: 'anonymous',
    stats: {
      postsCreated: 0,
      corroborationsGiven: 0,
      corroborationsReceived: 0,
      collectivesJoined: 0,
      verificationsCompleted: 0,
    },
    reputation: {
      overall: 50,
      byTopic: {},
      accuracyRate: 0,
    },
    collectiveMemberships: [],
    followedTopics: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Mock firefly service
vi.mock('@/lib/services/firefly-service', () => ({
  fireflyService: {
    updateProfile: vi.fn(),
  },
}));

import { fireflyService } from '@/lib/services/firefly-service';
// eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mocked handles binding
const mockUpdateProfile = vi.mocked(fireflyService.updateProfile);

const defaultTranslations = {
  editProfile: 'Edit Profile',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  pseudonym: 'Pseudonym',
  pseudonymHint: 'Your public name',
  displayName: 'Display Name',
  displayNameHint: 'Your real name (optional)',
  location: 'Location',
  locationHint: 'Where are you located?',
  bio: 'Bio',
  bioHint: 'Tell us about yourself',
  disclosureLevel: 'Privacy Level',
  anonymous: 'Anonymous',
  anonymousDesc: 'Only pseudonym visible',
  partial: 'Partial',
  partialDesc: 'Location visible',
  public: 'Public',
  publicDesc: 'All info visible',
  saved: 'Saved!',
  saveFailed: 'Failed to save',
};

const defaultInitialValues = {
  pseudonym: 'TestUser',
  disclosureLevel: 'anonymous' as DisclosureLevel,
};

const testCredential = createDIMCredential('dim-test-credential');

describe('ProfileEditForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUpdateProfile.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('shows edit button when not editing', () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
    });

    it('does not show form fields when not editing', () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      expect(screen.queryByLabelText('Pseudonym')).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('shows form when edit button clicked', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByLabelText('Pseudonym')).toBeInTheDocument();
    });

    it('shows pseudonym input with initial value', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, pseudonym: 'MyPseudonym' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByLabelText('Pseudonym')).toHaveValue('MyPseudonym');
    });

    it('shows character count for pseudonym', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, pseudonym: 'Test' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByText('Your public name (4/30)')).toBeInTheDocument();
    });

    it('shows disclosure level options', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByText('Anonymous')).toBeInTheDocument();
      expect(screen.getByText('Partial')).toBeInTheDocument();
      expect(screen.getByText('Public')).toBeInTheDocument();
    });
  });

  describe('disclosure level fields', () => {
    it('hides extra fields for anonymous level', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, disclosureLevel: 'anonymous' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Location')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Bio')).not.toBeInTheDocument();
    });

    it('shows displayName and location for partial level', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, disclosureLevel: 'partial' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toBeInTheDocument();
      expect(screen.queryByLabelText('Bio')).not.toBeInTheDocument();
    });

    it('shows all fields for public level', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, disclosureLevel: 'public' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toBeInTheDocument();
      expect(screen.getByLabelText('Bio')).toBeInTheDocument();
    });

    it('shows fields when switching to public', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, disclosureLevel: 'anonymous' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      // Switch to public
      await userEvent.click(screen.getByText('Public'));

      expect(screen.getByLabelText('Bio')).toBeInTheDocument();
    });
  });

  describe('cancel', () => {
    it('exits edit mode on cancel', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByLabelText('Pseudonym')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
    });

    it('resets form values on cancel', async () => {
      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, pseudonym: 'Original' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      const input = screen.getByLabelText('Pseudonym');
      await userEvent.clear(input);
      await userEvent.type(input, 'Changed');

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      expect(screen.getByLabelText('Pseudonym')).toHaveValue('Original');
    });
  });

  describe('save', () => {
    it('calls updateProfile on save', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        testCredential,
        expect.objectContaining({
          pseudonym: 'TestUser',
          disclosureLevel: 'anonymous',
        })
      );
    });

    it('shows success message after save', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });

    it('exits edit mode after successful save', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.queryByLabelText('Pseudonym')).not.toBeInTheDocument();
    });

    it('clears success message after timeout', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Saved!')).toBeInTheDocument();

      // Fast-forward past success timeout (3000ms)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
      });
    });

    it('calls onSaved callback after successful save', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      const onSaved = vi.fn();

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
          onSaved={onSaved}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSaved).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error message on save failure', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: false,
        error: 'Pseudonym already taken',
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Pseudonym already taken')).toBeInTheDocument();
    });

    it('stays in edit mode on error', async () => {
      mockUpdateProfile.mockResolvedValue({
        ok: false,
        error: 'Error',
      });

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByLabelText('Pseudonym')).toBeInTheDocument();
    });

    it('shows generic error on exception', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Network error'));

      render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  describe('timeout cleanup', () => {
    it('cleans up success timeout on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      mockUpdateProfile.mockResolvedValue({
        ok: true,
        value: createMockProfile(),
      });

      const { unmount } = render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={defaultInitialValues}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      // Unmount before success timeout clears
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('credential change', () => {
    it('resets form when credential changes', async () => {
      const { rerender } = render(
        <ProfileEditForm
          credentialHash={testCredential}
          initialValues={{ ...defaultInitialValues, pseudonym: 'User1' }}
          translations={defaultTranslations}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

      const input = screen.getByLabelText('Pseudonym');
      await userEvent.clear(input);
      await userEvent.type(input, 'Modified');

      // Simulate credential change
      const newCredential = createDIMCredential('dim-new-credential');
      rerender(
        <ProfileEditForm
          credentialHash={newCredential}
          initialValues={{ ...defaultInitialValues, pseudonym: 'User2' }}
          translations={defaultTranslations}
        />
      );

      // Should exit edit mode
      expect(screen.queryByLabelText('Pseudonym')).not.toBeInTheDocument();
    });
  });
});
