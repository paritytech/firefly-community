/**
 * Payment mode types for routing between public and private payments.
 *
 * The Firefly Network supports two payment layers:
 * - Public (pUSD on Asset Hub): Transparent, auditable, required for compliance
 * - Private (Coinage on People Chain): Anonymous, for sensitive payments
 *
 * This module provides logic for selecting the appropriate mode.
 */

/**
 * Payment mode: public (pUSD) or private (Coinage).
 */
export type PaymentMode = 'public' | 'private';

/**
 * Use cases that determine default payment mode.
 */
export type PaymentUseCase =
  | 'bounty_payout' // Paying journalist for bounty fulfillment
  | 'journalist_salary' // Regular salary payment to journalist
  | 'contribution' // Diaspora/supporter contribution to treasury
  | 'membership' // Membership fee payment
  | 'settlement' // Inter-outlet payment
  | 'source_payment' // Payment to confidential source
  | 'expense' // Expense reimbursement
  | 'offboard' // Converting to public pUSD for withdrawal
  | 'treasury_allocation'; // Treasury paying out to outlets

/**
 * Context for selecting payment mode.
 */
export interface PaymentModeContext {
  /** The type of payment being made */
  readonly useCase: PaymentUseCase;
  /** Sender's preferred mode (if any) */
  readonly senderPreference?: PaymentMode;
  /** Receiver's preferred mode (if any) */
  readonly receiverPreference?: PaymentMode;
  /** Whether compliance/audit trail is required */
  readonly complianceRequired?: boolean;
  /** Whether receiver has Coinage capability */
  readonly receiverHasCoinage?: boolean;
}

/**
 * Default payment modes by use case.
 * Sensitive cases default to private for journalist protection.
 */
export const DEFAULT_MODES: Record<PaymentUseCase, PaymentMode> = {
  bounty_payout: 'private', // Protect journalist identity
  journalist_salary: 'private', // Protect employment relationship
  contribution: 'private', // Protect contributor identity
  source_payment: 'private', // Critical: protect source
  expense: 'private', // Protect journalist activities
  membership: 'public', // Low sensitivity, needs compliance
  settlement: 'public', // Inter-organization, needs audit trail
  offboard: 'public', // Required for withdrawal
  treasury_allocation: 'public', // Governance transparency
};

/**
 * Use cases where privacy is strongly recommended.
 * Used for warnings when user selects public mode.
 */
export const HIGH_SENSITIVITY_CASES: readonly PaymentUseCase[] = [
  'bounty_payout',
  'journalist_salary',
  'source_payment',
];

/**
 * Use cases where public mode is required (cannot use private).
 */
export const PUBLIC_REQUIRED_CASES: readonly PaymentUseCase[] = ['offboard'];

/**
 * Select the appropriate payment mode based on context.
 *
 * Priority:
 * 1. Compliance required → public
 * 2. Public-required use case → public
 * 3. Receiver doesn't have Coinage → public
 * 4. Receiver prefers public → public (for sensitive cases, warn)
 * 5. Sender preference (if given)
 * 6. Default for use case
 */
export function selectPaymentMode(context: PaymentModeContext): {
  mode: PaymentMode;
  reason: string;
  warning?: string;
} {
  // Compliance always requires public
  if (context.complianceRequired === true) {
    return {
      mode: 'public',
      reason: 'Compliance requirements mandate auditable transactions',
    };
  }

  // Some use cases require public
  if (PUBLIC_REQUIRED_CASES.includes(context.useCase)) {
    return {
      mode: 'public',
      reason: `${context.useCase} requires public pUSD`,
    };
  }

  // If receiver can't use Coinage, must use public
  if (context.receiverHasCoinage === false) {
    return {
      mode: 'public',
      reason: 'Receiver does not have Coinage capability',
    };
  }

  // Receiver preference
  if (context.receiverPreference === 'public') {
    const isHighSensitivity = HIGH_SENSITIVITY_CASES.includes(context.useCase);
    if (isHighSensitivity) {
      return {
        mode: 'public',
        reason: 'Receiver requested public payment',
        warning: 'Warning: Public payments for this use case may expose sensitive information',
      };
    }
    return {
      mode: 'public',
      reason: 'Receiver requested public payment',
    };
  }

  // Sender preference (if given)
  if (context.senderPreference) {
    const isHighSensitivity = HIGH_SENSITIVITY_CASES.includes(context.useCase);
    if (context.senderPreference === 'public' && isHighSensitivity) {
      return {
        mode: 'public',
        reason: 'Sender requested public payment',
        warning: 'Warning: Public payments for this use case may expose sensitive information',
      };
    }
    return {
      mode: context.senderPreference,
      reason: 'Using sender preference',
    };
  }

  // Default based on use case
  const defaultMode = DEFAULT_MODES[context.useCase];
  return {
    mode: defaultMode,
    reason: `Default for ${context.useCase}`,
  };
}

/**
 * Check if a use case supports both payment modes.
 */
export function supportsBothModes(useCase: PaymentUseCase): boolean {
  return !PUBLIC_REQUIRED_CASES.includes(useCase);
}

/**
 * Get human-readable description of a payment mode.
 */
export function describePaymentMode(mode: PaymentMode): {
  name: string;
  description: string;
  features: readonly string[];
} {
  if (mode === 'public') {
    return {
      name: 'Public (pUSD)',
      description: 'Transparent payment on Polkadot Asset Hub',
      features: [
        'Transactions visible on-chain',
        'Auditable for compliance',
        'Can be converted to fiat',
        'Sender and receiver addresses visible',
      ],
    };
  }

  return {
    name: 'Private (Coinage)',
    description: 'Anonymous payment via Polkadot Coinage',
    features: [
      'Sender and receiver identities hidden',
      'Balance not visible on-chain',
      'Minimal transaction tracing',
      'Free for verified humans (DIM)',
    ],
  };
}

/**
 * Get recommendation text for a use case.
 */
export function getRecommendation(useCase: PaymentUseCase): string {
  const defaultMode = DEFAULT_MODES[useCase];
  const isHighSensitivity = HIGH_SENSITIVITY_CASES.includes(useCase);

  if (isHighSensitivity) {
    return 'Private mode strongly recommended to protect identities';
  }

  if (PUBLIC_REQUIRED_CASES.includes(useCase)) {
    return 'Public mode required for this operation';
  }

  return defaultMode === 'private'
    ? 'Private mode recommended'
    : 'Public mode recommended for transparency';
}
