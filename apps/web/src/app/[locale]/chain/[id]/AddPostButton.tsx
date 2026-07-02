'use client';

/**
 * AddPostButton — Opens the Illuminate modal with chain pre-selected.
 */

import type { ReactElement } from 'react';
import { Button } from '@cocuyo/ui';
import type { ChainId } from '@cocuyo/types';
import { useIlluminate } from '@/hooks/useIlluminate';

interface AddPostButtonProps {
  chainId: ChainId;
  variant?: 'illuminate' | 'primary';
  className?: string;
  children?: React.ReactNode;
}

export function AddPostButton({
  chainId,
  variant = 'illuminate',
  className,
  children = 'Add Post to Story',
}: AddPostButtonProps): ReactElement {
  const { openModal } = useIlluminate();

  return (
    <Button variant={variant} className={className} onClick={() => openModal({ chainId })}>
      {children}
    </Button>
  );
}
