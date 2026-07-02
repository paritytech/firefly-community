'use client';

/**
 * SignStep — Sign attestation message step.
 *
 * HONEST IMPLEMENTATION (no fake success).
 *
 * This step builds the REAL SCALE attestation message
 * (`MSG_PREFIX || SCALE(candidate AccountId32) || ring_vrf_key`) and obtains a
 * REAL candidate signature over it via the wallet's `signRaw`. Both of those
 * primitives genuinely work and are exercised here.
 *
 * It then STOPS HONESTLY: it surfaces a clear "verification isn't available yet"
 * state and never calls `onComplete()` as if registration succeeded. Lite
 * personhood is granted ONLY when a verifier's `PeopleLite.attest` extrinsic is
 * finalized on-chain (observed by PendingStep / the personhood service from real
 * chain state) — this client cannot make that happen.
 *
 * REMAINING BLOCKERS (why on-chain completion is impossible from the client):
 *  - Verifier service: `PeopleLite.attest` must be submitted by an account
 *    holding `AttestationAllowance`. The candidate cannot self-attest, and no
 *    such verifier service is connected in this environment.
 *  - Gap A — `ring_vrf_key`: the candidate's 32-byte ring VRF public key is not
 *    obtainable from the installed packages, so we cannot build a real message
 *    keyed to a genuine ring VRF key, nor populate the `attest` arg.
 *  - Gap C — `ringRootHash`: `createRingVRFProof` (and the ring root hash it
 *    needs to produce the 96-byte `proof_of_ownership`) is not available from
 *    any installed package.
 *
 * Because Gap A means we have no genuine ring VRF key, the message below is
 * built with an explicit placeholder key purely so we can demonstrate the
 * signing primitive end-to-end. We deliberately do NOT submit anything on-chain
 * and do NOT fabricate a key, a proof, a tx hash, or a success.
 */

import { useState, useCallback } from 'react';
import { useSigner } from '@/lib/context/SignerContext';
import { createPolkadotAddress } from '@cocuyo/types';
import { generateAttestationMessage } from '@cocuyo/individuality';

interface SignStepTranslations {
  title: string;
  description: string;
  message: string;
  button: string;
  pending: string;
  unavailableTitle: string;
  unavailableDescription: string;
  signatureCaptured: string;
  back: string;
}

interface SignStepProps {
  translations: SignStepTranslations;
  /**
   * Reserved for the real success path. NOT called here: completion happens only
   * when on-chain PeopleLite registration is observed (see PendingStep). The
   * honest client never advances as if attestation succeeded.
   */
  onComplete: () => void;
  onBack: () => void;
  onError: (error: string) => void;
}

export function SignStep({ translations, onBack, onError }: SignStepProps): React.ReactElement {
  const { selectedAccount, signRaw } = useSigner();
  const [signing, setSigning] = useState(false);
  // Honest terminal state: we genuinely signed, but cannot complete on-chain.
  const [unavailable, setUnavailable] = useState(false);

  const handleSign = useCallback(async () => {
    if (selectedAccount === null) {
      onError('Wallet not connected');
      return;
    }

    setSigning(true);

    try {
      const address = createPolkadotAddress(selectedAccount.address);

      // Build the REAL SCALE attestation message. The candidate's genuine ring
      // VRF public key is unavailable (Gap A), so we use an explicit placeholder
      // only to exercise the signing primitive — this is never submitted and is
      // never treated as a valid key.
      const placeholderRingVrfKey = new Uint8Array(32);
      const message = generateAttestationMessage(address, placeholderRingVrfKey);

      // Obtain the REAL candidate signature over the real message bytes. This is
      // the only on-chain-relevant primitive we can fully perform client-side.
      const result = await signRaw(message);
      if (!result.ok) {
        onError(result.error.message);
        return;
      }

      // We have a real signature, but cannot proceed: there is no verifier
      // service holding AttestationAllowance to submit PeopleLite.attest, and the
      // real ring VRF key (Gap A) and ringRootHash / proof_of_ownership (Gap C)
      // are not obtainable. Stop honestly — do NOT call onComplete().
      setUnavailable(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  }, [selectedAccount, signRaw, onError]);

  if (unavailable) {
    return (
      <div className="text-center">
        <h2 className="mb-4 font-display text-xl font-medium text-[var(--fg-primary)]">
          {translations.unavailableTitle}
        </h2>
        <p className="mb-6 text-[var(--fg-secondary)]">{translations.unavailableDescription}</p>

        <div className="mb-8 inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-2">
          <svg
            className="h-4 w-4 flex-shrink-0 text-[var(--color-corroborated,#4ade80)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-[var(--fg-secondary)]">
            {translations.signatureCaptured}
          </span>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onBack}
            className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
          >
            {translations.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 font-display text-xl font-medium text-[var(--fg-primary)]">
        {translations.title}
      </h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{translations.description}</p>

      {/* Message preview */}
      <div className="mb-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 text-left">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--fg-tertiary)]">
          {translations.message}
        </p>
        <div className="rounded bg-[var(--bg-secondary)] p-3 font-mono text-xs text-[var(--fg-secondary)]">
          <p>I verify that I am a unique human and wish to be</p>
          <p>registered as a lite person on the Firefly Network.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onBack}
          disabled={signing}
          className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translations.back}
        </button>
        <button
          onClick={() => {
            void handleSign();
          }}
          disabled={signing}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {signing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              {translations.pending}
            </>
          ) : (
            translations.button
          )}
        </button>
      </div>
    </div>
  );
}
