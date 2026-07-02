/**
 * @cocuyo/bulletin — Content-addressed storage for F-Network.
 */

// CID calculation
export {
  calculateCID,
  calculateCIDFromString,
  calculateCIDFromJSON,
  isValidCID,
  parseCID,
} from './cid';

// Client
export {
  createBulletinClient,
  createRecord,
  BULLETIN_ENDPOINTS,
  IPFS_GATEWAYS,
  type BulletinClient,
  type BulletinRecord,
  type BulletinEnvironment,
  type RecordType,
  type ReadOptions,
  type WriteOptions,
  type ClientOptions,
} from './client';

// Upload
export {
  prepareBulletinUpload,
  prepareBulletinJSONUpload,
  uploadToBulletin,
  uploadJSONToBulletin,
  type UploadResult,
  type UploadOptions,
} from './upload';

// Indexes
export {
  createIndexManager,
  type IndexManager,
  type SignalIndex,
  type SignalIndexEntry,
  type CollectiveIndex,
  type CollectiveIndexEntry,
  type UserIndex,
} from './indexes';
