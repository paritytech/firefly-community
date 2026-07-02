/**
 * FireflyReputation ABI - Essential functions for frontend interaction.
 */
export const FIREFLY_REPUTATION_ABI = [
  // Constants
  {
    inputs: [],
    name: 'DEFAULT_SCORE',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_SCORE',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_SCORE',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },

  // View functions
  {
    inputs: [
      { name: 'credential_', type: 'bytes32' },
      { name: 'topic_', type: 'bytes32' },
    ],
    name: 'getScore',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'credential_', type: 'bytes32' },
      { name: 'topic_', type: 'bytes32' },
    ],
    name: 'getTopicScore',
    outputs: [
      {
        components: [
          { name: 'score', type: 'uint16' },
          { name: 'corroborationsGiven', type: 'uint32' },
          { name: 'corroborationsReceived', type: 'uint32' },
          { name: 'challengesWon', type: 'uint32' },
          { name: 'challengesLost', type: 'uint32' },
          { name: 'lastUpdated', type: 'uint64' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'credential_', type: 'bytes32' },
      { name: 'topics_', type: 'bytes32[]' },
    ],
    name: 'getScores',
    outputs: [{ name: '', type: 'uint16[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTopics',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'topicCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'topic_', type: 'string' }],
    name: 'topicHash',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'isRegisteredTopic',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'updaters',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'credential', type: 'bytes32' },
      { indexed: true, name: 'topic', type: 'bytes32' },
      { indexed: false, name: 'oldScore', type: 'uint16' },
      { indexed: false, name: 'newScore', type: 'uint16' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
    name: 'ScoreUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'corroboratorCredential', type: 'bytes32' },
      { indexed: true, name: 'authorCredential', type: 'bytes32' },
      { indexed: true, name: 'topic', type: 'bytes32' },
      { indexed: false, name: 'signalId', type: 'bytes32' },
    ],
    name: 'CorroborationRecorded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'challengedCredential', type: 'bytes32' },
      { indexed: true, name: 'topic', type: 'bytes32' },
      { indexed: false, name: 'signalId', type: 'bytes32' },
    ],
    name: 'ChallengeRecorded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'topic', type: 'bytes32' },
      { indexed: false, name: 'name', type: 'string' },
    ],
    name: 'TopicRegistered',
    type: 'event',
  },
] as const;

// TypeScript types for contract interactions
export interface TopicScore {
  score: number;
  corroborationsGiven: number;
  corroborationsReceived: number;
  challengesWon: number;
  challengesLost: number;
  lastUpdated: bigint;
}

// Default topics registered in the contract
export const DEFAULT_TOPICS = [
  'economy',
  'health',
  'politics',
  'infrastructure',
  'human-rights',
  'environment',
  'security',
  'education',
] as const;

export type DefaultTopic = (typeof DEFAULT_TOPICS)[number];
