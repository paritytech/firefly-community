'use client';

/**
 * ProfileEditForm — Client component for editing profile fields.
 *
 * Allows users to edit:
 * - Pseudonym (max 30 chars)
 * - Display name (optional)
 * - Location (optional)
 * - Bio (max 500 chars)
 * - Disclosure level
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { DisclosureLevel, DIMCredential } from '@cocuyo/types';
import { Button } from '@cocuyo/ui';
import { fireflyService } from '@/lib/services/firefly-service';

interface ProfileEditFormTranslations {
  editProfile: string;
  save: string;
  saving: string;
  cancel: string;
  pseudonym: string;
  pseudonymHint: string;
  displayName: string;
  displayNameHint: string;
  location: string;
  locationHint: string;
  bio: string;
  bioHint: string;
  disclosureLevel: string;
  anonymous: string;
  anonymousDesc: string;
  partial: string;
  partialDesc: string;
  public: string;
  publicDesc: string;
  saved: string;
  saveFailed: string;
}

export interface ProfileEditFormProps {
  /** The user's DIM credential */
  credentialHash: DIMCredential;
  /** Current profile values */
  initialValues: {
    pseudonym: string;
    disclosureLevel: DisclosureLevel;
    displayName?: string;
    location?: string;
    bio?: string;
  };
  /** Translation strings */
  translations: ProfileEditFormTranslations;
  /** Callback when profile is saved */
  onSaved?: () => void;
}

export function ProfileEditForm({
  credentialHash,
  initialValues,
  translations: t,
  onSaved,
}: ProfileEditFormProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Ref for success message timeout cleanup
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Form state
  const [pseudonym, setPseudonym] = useState(initialValues.pseudonym);
  const [displayName, setDisplayName] = useState(initialValues.displayName ?? '');
  const [location, setLocation] = useState(initialValues.location ?? '');
  const [bio, setBio] = useState(initialValues.bio ?? '');
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>(
    initialValues.disclosureLevel
  );

  // Reset form when credential changes (wallet switching)
  useEffect(() => {
    // Clear any pending success timeout to prevent old timer affecting new session
    if (successTimeoutRef.current !== null) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    setPseudonym(initialValues.pseudonym);
    setDisplayName(initialValues.displayName ?? '');
    setLocation(initialValues.location ?? '');
    setBio(initialValues.bio ?? '');
    setDisclosureLevel(initialValues.disclosureLevel);
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  }, [credentialHash, initialValues]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Build publicInfo without undefined values (exactOptionalPropertyTypes)
      const publicInfo: {
        displayName?: string;
        location?: string;
        bio?: string;
      } = {};

      const trimmedDisplayName = displayName.trim();
      const trimmedLocation = location.trim();
      const trimmedBio = bio.trim();

      if (trimmedDisplayName) publicInfo.displayName = trimmedDisplayName;
      if (trimmedLocation) publicInfo.location = trimmedLocation;
      if (trimmedBio) publicInfo.bio = trimmedBio;

      const updateData: {
        pseudonym: string;
        disclosureLevel: DisclosureLevel;
        publicInfo?: typeof publicInfo;
      } = {
        pseudonym: pseudonym.trim(),
        disclosureLevel,
      };

      if (Object.keys(publicInfo).length > 0) {
        updateData.publicInfo = publicInfo;
      }

      const result = await fireflyService.updateProfile(credentialHash, updateData);

      if (result.ok) {
        setSuccess(true);
        setIsEditing(false);
        onSaved?.();
        // Clear success message after 3 seconds
        if (successTimeoutRef.current !== null) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
          successTimeoutRef.current = null;
          setSuccess(false);
        }, 3000);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  }, [credentialHash, pseudonym, displayName, location, bio, disclosureLevel, t, onSaved]);

  const handleCancel = useCallback(() => {
    // Reset to initial values
    setPseudonym(initialValues.pseudonym);
    setDisplayName(initialValues.displayName ?? '');
    setLocation(initialValues.location ?? '');
    setBio(initialValues.bio ?? '');
    setDisclosureLevel(initialValues.disclosureLevel);
    setIsEditing(false);
    setError(null);
  }, [initialValues]);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
          {t.editProfile}
        </Button>
        {success && <span className="text-sm text-[var(--fg-success)]">{t.saved}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error != null && error !== '' && (
        <div className="border-[var(--fg-error)]/30 bg-[var(--fg-error)]/10 rounded-nested border p-3 text-sm text-[var(--fg-error)]">
          {error}
        </div>
      )}

      {/* Pseudonym */}
      <div>
        <label
          htmlFor="pseudonym"
          className="mb-1 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.pseudonym}
        </label>
        <input
          id="pseudonym"
          type="text"
          value={pseudonym}
          onChange={(e) => setPseudonym(e.target.value)}
          maxLength={30}
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-firefly-gold)]"
        />
        <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
          {t.pseudonymHint} ({pseudonym.length}/30)
        </p>
      </div>

      {/* Disclosure level */}
      <div>
        <span className="mb-2 block text-sm font-medium text-[var(--fg-primary)]">
          {t.disclosureLevel}
        </span>
        <div className="space-y-2">
          {(['anonymous', 'partial', 'public'] as const).map((level) => (
            <label
              key={level}
              className={`flex cursor-pointer items-start gap-3 rounded-nested border p-3 transition-colors ${
                disclosureLevel === level
                  ? 'bg-[var(--color-firefly-gold)]/5 border-[var(--color-firefly-gold)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-emphasis)]'
              }`}
            >
              <input
                type="radio"
                name="disclosureLevel"
                value={level}
                checked={disclosureLevel === level}
                onChange={() => setDisclosureLevel(level)}
                className="mt-0.5"
              />
              <div>
                <span className="block text-sm font-medium text-[var(--fg-primary)]">
                  {t[level]}
                </span>
                <span className="text-xs text-[var(--fg-secondary)]">{t[`${level}Desc`]}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Display name (only relevant for partial/public) */}
      {disclosureLevel !== 'anonymous' && (
        <div>
          <label
            htmlFor="displayName"
            className="mb-1 block text-sm font-medium text-[var(--fg-primary)]"
          >
            {t.displayName}
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-firefly-gold)]"
          />
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">{t.displayNameHint}</p>
        </div>
      )}

      {/* Location (only relevant for partial/public) */}
      {disclosureLevel !== 'anonymous' && (
        <div>
          <label
            htmlFor="location"
            className="mb-1 block text-sm font-medium text-[var(--fg-primary)]"
          >
            {t.location}
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-firefly-gold)]"
          />
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">{t.locationHint}</p>
        </div>
      )}

      {/* Bio (only relevant for public) */}
      {disclosureLevel === 'public' && (
        <div>
          <label htmlFor="bio" className="mb-1 block text-sm font-medium text-[var(--fg-primary)]">
            {t.bio}
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-firefly-gold)]"
          />
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
            {t.bioHint} ({bio.length}/500)
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            void handleSave();
          }}
          disabled={isSaving}
        >
          {isSaving ? t.saving : t.save}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleCancel} disabled={isSaving}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
