'use client';

/**
 * useBulletin — Hook for Bulletin Chain operations.
 *
 * Provides CID calculation and content storage functionality.
 * Full chain upload requires Triangle host with signed transactions.
 *
 * @example
 * const { prepareCID, upload, isReady } = useBulletin();
 * const { cid } = prepareCID({ type: 'signal', data: signalData });
 */

import { useMemo } from 'react';
import {
  createBulletinClient,
  prepareBulletinJSONUpload,
  uploadJSONToBulletin,
  type BulletinClient,
  type BulletinRecord,
  type UploadResult,
} from '@cocuyo/bulletin';

export interface UseBulletinResult {
  /** Bulletin client for read/write operations */
  client: BulletinClient;
  /** Calculate CID without uploading (works offline) */
  prepareCID: <T>(record: BulletinRecord<T>) => UploadResult;
  /** Upload record to Bulletin (requires Triangle host) */
  upload: <T>(record: BulletinRecord<T>) => Promise<UploadResult>;
  /** Whether the client is ready for operations */
  isReady: boolean;
}

/**
 * Hook to access Bulletin Chain functionality.
 *
 * CID calculation works immediately. Full chain upload
 * requires running in Triangle host with signed transactions.
 */
export function useBulletin(): UseBulletinResult {
  const client = useMemo(() => createBulletinClient(), []);

  const prepareCID = useMemo(() => {
    return <T>(record: BulletinRecord<T>): UploadResult => {
      return prepareBulletinJSONUpload(record, { environment: 'PREVIEWNET' });
    };
  }, []);

  const upload = useMemo(() => {
    return <T>(record: BulletinRecord<T>): Promise<UploadResult> => {
      return uploadJSONToBulletin(record, { environment: 'PREVIEWNET' });
    };
  }, []);

  return {
    client,
    prepareCID,
    upload,
    isReady: true,
  };
}
