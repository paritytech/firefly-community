/**
 * Tests for the CorroborateDisputeSheet submit UX — specifically the inline error surfacing
 * (a toast renders behind the sheet's z-[100] backdrop, so the specific failure must also show
 * inline, readable, with role="alert"), success closing the sheet, and clearing on edit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';

const { submitMock, addToastMock, closeSheetMock, ctx } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  addToastMock: vi.fn(),
  closeSheetMock: vi.fn(),
  ctx: {
    isOpen: true,
    mode: 'corroborate' as 'corroborate' | 'dispute',
    campaign: null as unknown,
    post: {
      id: 'post-1',
      content: { text: 'A post to corroborate' },
      author: { pseudonym: 'anon' },
    },
    closeSheet: (): void => {
      closeSheetMock();
    },
  },
}));

vi.mock('./CorroborateDisputeProvider', () => ({ useCorroborateDispute: () => ctx }));
vi.mock('@/components/AppStateProvider', () => ({
  useAppState: () => ({ submitCorroboration: submitMock }),
}));
vi.mock('@cocuyo/ui', () => ({ useToast: () => ({ addToast: addToastMock }) }));

import { CorroborateDisputeSheet } from './CorroborateDisputeSheet';

const observe = (text: string): void => {
  fireEvent.change(screen.getByPlaceholderText('Describe what you witnessed...'), {
    target: { value: text },
  });
};
const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.mode = 'corroborate';
});

describe('CorroborateDisputeSheet submit', () => {
  it('surfaces the specific failure inline (role="alert") and does not close the sheet', async () => {
    submitMock.mockResolvedValue({
      ok: false,
      error: 'Host denied the BulletIn storage allowance',
    });
    render(<CorroborateDisputeSheet />);
    observe('I saw it');
    await act(async () => {
      submit();
      await Promise.resolve();
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Host denied the BulletIn storage allowance');
    // Also surfaced as a toast (for after the sheet closes), and the sheet stays open.
    expect(addToastMock).toHaveBeenCalledWith(
      'Host denied the BulletIn storage allowance',
      'error'
    );
    expect(closeSheetMock).not.toHaveBeenCalled();
  });

  it('closes the sheet on success and shows no error', async () => {
    submitMock.mockResolvedValue({ ok: true, value: { id: 'c1' } });
    render(<CorroborateDisputeSheet />);
    observe('I saw it');
    await act(async () => {
      submit();
      await Promise.resolve();
    });

    await waitFor(() => expect(closeSheetMock).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the inline error when the user edits the form again', async () => {
    submitMock.mockResolvedValue({ ok: false, error: 'Bulletin writes require the Polkadot host' });
    render(<CorroborateDisputeSheet />);
    observe('first');
    await act(async () => {
      submit();
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    observe('second try'); // editing clears the stale error
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
