/**
 * Hook for interacting with the FireflyReputation contract.
 *
 * Provides methods to:
 * - Read reputation scores by topic
 * - Get topic metadata
 * - Convert topic names to hashes
 */

'use client';

import { useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { getContractAddress, getRpcUrl, type NetworkName } from '@/lib/chain/evm/config';
import { createLogger } from '@/lib/logging';

const log = createLogger('useFireflyReputation');
import {
  FIREFLY_REPUTATION_ABI,
  DEFAULT_TOPICS,
  type TopicScore,
  type DefaultTopic,
} from '@/lib/chain/evm/abis';

export interface UseFireflyReputationOptions {
  network?: NetworkName;
}

export interface UseFireflyReputationResult {
  contractAddress: string | null;
  getScore: (credential: string, topic: string) => Promise<number>;
  getTopicScore: (credential: string, topic: string) => Promise<TopicScore>;
  getScores: (credential: string, topics: string[]) => Promise<Map<string, number>>;
  getAllDefaultScores: (credential: string) => Promise<Map<DefaultTopic, number>>;
  getTopics: () => Promise<string[]>;
  getTopicCount: () => Promise<number>;
  isTopicRegistered: (topic: string) => Promise<boolean>;
  isUpdater: (address: string) => Promise<boolean>;
  getConstants: () => Promise<{ defaultScore: number; minScore: number; maxScore: number }>;
  toCredentialHash: (credential: string) => string;
  toTopicHash: (topic: string) => string;
  DEFAULT_TOPICS: typeof DEFAULT_TOPICS;
}

export function useFireflyReputation(
  options: UseFireflyReputationOptions = {}
): UseFireflyReputationResult {
  const { network } = options;

  // Get contract instance (read-only)
  const getReadContract = useCallback((): ethers.Contract => {
    const address = getContractAddress('fireflyReputation', network);
    if (address === null) {
      throw new Error('FireflyReputation contract not deployed on this network');
    }
    const provider = new ethers.JsonRpcProvider(getRpcUrl(network));
    return new ethers.Contract(address, FIREFLY_REPUTATION_ABI, provider);
  }, [network]);

  // Convert credential string to bytes32
  const toCredentialHash = useCallback((credential: string): string => {
    // If already a bytes32 hex string, return as-is
    if (credential.startsWith('0x') && credential.length === 66) {
      return credential;
    }
    return ethers.keccak256(ethers.toUtf8Bytes(credential));
  }, []);

  // Convert topic name to bytes32 hash (matches contract's topicHash function)
  const toTopicHash = useCallback((topic: string): string => {
    return ethers.keccak256(ethers.toUtf8Bytes(topic));
  }, []);

  // Read: Get score for a credential on a topic
  const getScore = useCallback(
    async (credential: string, topic: string): Promise<number> => {
      try {
        const contract = getReadContract();
        const credHash = toCredentialHash(credential);
        const topicHash = toTopicHash(topic);
        // Type assertion: getScore returns uint16 per ABI, ethers returns bigint
        const score = (await contract.getFunction('getScore')(credHash, topicHash)) as bigint;
        return Number(score);
      } catch (err) {
        log.error('Failed to get score', 'getScore', err, { credential, topic });
        return 500; // Default score
      }
    },
    [getReadContract, toCredentialHash, toTopicHash]
  );

  // Read: Get full topic score details
  const getTopicScore = useCallback(
    async (credential: string, topic: string): Promise<TopicScore> => {
      try {
        const contract = getReadContract();
        const credHash = toCredentialHash(credential);
        const topicHash = toTopicHash(topic);
        // Type assertion: getTopicScore returns TopicScore struct per ABI
        const result = (await contract.getFunction('getTopicScore')(credHash, topicHash)) as {
          score: bigint;
          corroborationsGiven: bigint;
          corroborationsReceived: bigint;
          challengesWon: bigint;
          challengesLost: bigint;
          lastUpdated: bigint;
        };

        return {
          score: Number(result.score),
          corroborationsGiven: Number(result.corroborationsGiven),
          corroborationsReceived: Number(result.corroborationsReceived),
          challengesWon: Number(result.challengesWon),
          challengesLost: Number(result.challengesLost),
          lastUpdated: result.lastUpdated,
        };
      } catch (err) {
        log.error('Failed to get topic score', 'getTopicScore', err, { credential, topic });
        return {
          score: 500,
          corroborationsGiven: 0,
          corroborationsReceived: 0,
          challengesWon: 0,
          challengesLost: 0,
          lastUpdated: 0n,
        };
      }
    },
    [getReadContract, toCredentialHash, toTopicHash]
  );

  // Read: Get scores for multiple topics
  const getScores = useCallback(
    async (credential: string, topics: string[]): Promise<Map<string, number>> => {
      try {
        const contract = getReadContract();
        const credHash = toCredentialHash(credential);
        const topicHashes = topics.map(toTopicHash);
        // Type assertion: getScores returns uint16[] per ABI, ethers returns bigint[]
        const scores = (await contract.getFunction('getScores')(credHash, topicHashes)) as bigint[];

        const result = new Map<string, number>();
        topics.forEach((topic, i) => {
          result.set(topic, Number(scores[i]));
        });
        return result;
      } catch (err) {
        log.error('Failed to get scores', 'getScores', err, {
          credential,
          topicCount: topics.length,
        });
        const result = new Map<string, number>();
        topics.forEach((topic) => result.set(topic, 500));
        return result;
      }
    },
    [getReadContract, toCredentialHash, toTopicHash]
  );

  // Read: Get all scores for default topics
  const getAllDefaultScores = useCallback(
    async (credential: string): Promise<Map<DefaultTopic, number>> => {
      const scores = await getScores(credential, [...DEFAULT_TOPICS]);
      // Type assertion: Map keys are narrowed from string to DefaultTopic since we passed DEFAULT_TOPICS
      return scores as Map<DefaultTopic, number>;
    },
    [getScores]
  );

  // Read: Get all registered topic hashes
  const getTopics = useCallback(async (): Promise<string[]> => {
    try {
      const contract = getReadContract();
      // Type assertion: getTopics returns bytes32[] per ABI as hex strings
      const topics = (await contract.getFunction('getTopics')()) as string[];
      return topics;
    } catch (err) {
      log.error('Failed to get topics', 'getTopics', err);
      return [];
    }
  }, [getReadContract]);

  // Read: Get topic count
  const getTopicCount = useCallback(async (): Promise<number> => {
    try {
      const contract = getReadContract();
      // Type assertion: topicCount returns uint256 per ABI, ethers returns bigint
      const count = (await contract.getFunction('topicCount')()) as bigint;
      return Number(count);
    } catch (err) {
      log.error('Failed to get topic count', 'getTopicCount', err);
      return 0;
    }
  }, [getReadContract]);

  // Read: Check if topic is registered
  const isTopicRegistered = useCallback(
    async (topic: string): Promise<boolean> => {
      try {
        const contract = getReadContract();
        const topicHash = toTopicHash(topic);
        // Type assertion: isRegisteredTopic returns bool per ABI
        const result = (await contract.getFunction('isRegisteredTopic')(topicHash)) as boolean;
        return result;
      } catch {
        return false;
      }
    },
    [getReadContract, toTopicHash]
  );

  // Read: Check if address is an updater
  const isUpdater = useCallback(
    async (address: string): Promise<boolean> => {
      try {
        const contract = getReadContract();
        // Type assertion: updaters mapping returns bool per ABI
        const result = (await contract.getFunction('updaters')(address)) as boolean;
        return result;
      } catch {
        return false;
      }
    },
    [getReadContract]
  );

  // Read: Get constants
  const getConstants = useCallback(async (): Promise<{
    defaultScore: number;
    minScore: number;
    maxScore: number;
  }> => {
    try {
      const contract = getReadContract();
      // Type assertion: These constants are uint16 per ABI, ethers returns bigint
      const [defaultScore, minScore, maxScore] = (await Promise.all([
        contract.getFunction('DEFAULT_SCORE')(),
        contract.getFunction('MIN_SCORE')(),
        contract.getFunction('MAX_SCORE')(),
      ])) as [bigint, bigint, bigint];
      return {
        defaultScore: Number(defaultScore),
        minScore: Number(minScore),
        maxScore: Number(maxScore),
      };
    } catch (err) {
      log.error('Failed to get constants', 'getConstants', err);
      return { defaultScore: 500, minScore: 0, maxScore: 1000 };
    }
  }, [getReadContract]);

  // Contract address for display
  const contractAddress = useMemo(
    () => getContractAddress('fireflyReputation', network),
    [network]
  );

  return {
    contractAddress,

    // Read methods
    getScore,
    getTopicScore,
    getScores,
    getAllDefaultScores,
    getTopics,
    getTopicCount,
    isTopicRegistered,
    isUpdater,
    getConstants,

    // Utilities
    toCredentialHash,
    toTopicHash,
    DEFAULT_TOPICS,
  };
}
