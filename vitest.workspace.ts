import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types',
  'packages/network-config',
  'packages/bulletin',
  'packages/identity',
  'packages/individuality',
  'packages/ui',
  'apps/web',
]);
