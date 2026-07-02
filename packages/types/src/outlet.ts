/**
 * Outlet types — news organizations that sponsor fact-checking campaigns.
 */

import type { OutletId } from './brands';

/**
 * A news outlet or journalism organization.
 */
export interface Outlet {
  readonly id: OutletId;
  readonly name: string;
  readonly description: string;
  readonly country: string;
  readonly website?: string;
  readonly topics: readonly string[];
  readonly foundedYear?: number;
  readonly verifiedAt?: number;
  readonly cid?: string;
}

/**
 * Lightweight preview of an outlet for list views.
 */
export interface OutletPreview {
  readonly id: OutletId;
  readonly name: string;
  readonly country: string;
  readonly topics: readonly string[];
}
