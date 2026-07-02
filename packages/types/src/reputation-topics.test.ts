/**
 * Tests for reputation-topics utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  REPUTATION_TOPICS,
  TOPIC_METADATA,
  isReputationTopic,
  getTopicMetadata,
  classifyTopics,
} from './reputation-topics';

describe('REPUTATION_TOPICS', () => {
  it('contains all expected topics', () => {
    expect(REPUTATION_TOPICS).toContain('politics');
    expect(REPUTATION_TOPICS).toContain('environment');
    expect(REPUTATION_TOPICS).toContain('health');
    expect(REPUTATION_TOPICS).toContain('economy');
    expect(REPUTATION_TOPICS).toContain('infrastructure');
    expect(REPUTATION_TOPICS).toContain('human-rights');
    expect(REPUTATION_TOPICS).toContain('security');
    expect(REPUTATION_TOPICS).toContain('education');
  });

  it('has exactly 8 topics', () => {
    expect(REPUTATION_TOPICS).toHaveLength(8);
  });

  it('is a readonly array', () => {
    expect(Array.isArray(REPUTATION_TOPICS)).toBe(true);
  });
});

describe('TOPIC_METADATA', () => {
  it('has metadata for all topics', () => {
    for (const topic of REPUTATION_TOPICS) {
      expect(TOPIC_METADATA[topic]).toBeDefined();
      expect(TOPIC_METADATA[topic].id).toBe(topic);
      expect(TOPIC_METADATA[topic].label).toBeDefined();
      expect(TOPIC_METADATA[topic].description).toBeDefined();
      expect(TOPIC_METADATA[topic].keywords).toBeDefined();
      expect(Array.isArray(TOPIC_METADATA[topic].keywords)).toBe(true);
      expect(TOPIC_METADATA[topic].keywords.length).toBeGreaterThan(0);
    }
  });

  it('economy has expected keywords', () => {
    expect(TOPIC_METADATA.economy.keywords).toContain('price');
    expect(TOPIC_METADATA.economy.keywords).toContain('inflation');
  });

  it('politics has expected keywords', () => {
    expect(TOPIC_METADATA.politics.keywords).toContain('election');
    expect(TOPIC_METADATA.politics.keywords).toContain('government');
  });
});

describe('isReputationTopic', () => {
  it('returns true for valid topics', () => {
    expect(isReputationTopic('politics')).toBe(true);
    expect(isReputationTopic('environment')).toBe(true);
    expect(isReputationTopic('health')).toBe(true);
    expect(isReputationTopic('economy')).toBe(true);
    expect(isReputationTopic('human-rights')).toBe(true);
    expect(isReputationTopic('infrastructure')).toBe(true);
    expect(isReputationTopic('security')).toBe(true);
    expect(isReputationTopic('education')).toBe(true);
  });

  it('returns false for invalid topics', () => {
    expect(isReputationTopic('invalid')).toBe(false);
    expect(isReputationTopic('')).toBe(false);
    expect(isReputationTopic('POLITICS')).toBe(false);
    expect(isReputationTopic('local-news')).toBe(false);
  });
});

describe('getTopicMetadata', () => {
  it('returns metadata for valid topic', () => {
    const metadata = getTopicMetadata('politics');
    expect(metadata.id).toBe('politics');
    expect(metadata.label).toBe('Politics');
    expect(metadata.description).toBeDefined();
    expect(metadata.keywords.length).toBeGreaterThan(0);
  });

  it('returns metadata for all topics', () => {
    for (const topic of REPUTATION_TOPICS) {
      const metadata = getTopicMetadata(topic);
      expect(metadata).toBeDefined();
      expect(metadata.id).toBe(topic);
    }
  });
});

describe('classifyTopics', () => {
  it('classifies text containing politics keywords', () => {
    const topics = classifyTopics('The government election results were announced today');
    expect(topics).toContain('politics');
  });

  it('classifies text containing environment keywords', () => {
    const topics = classifyTopics('Pollution contamination in the water supply');
    expect(topics).toContain('environment');
  });

  it('classifies text containing health keywords', () => {
    const topics = classifyTopics('The hospital pharmacy has medicine shortages');
    expect(topics).toContain('health');
  });

  it('classifies text containing economy keywords', () => {
    const topics = classifyTopics('Market prices and inflation are rising');
    expect(topics).toContain('economy');
  });

  it('can classify multiple topics', () => {
    const topics = classifyTopics('Government law on electricity water infrastructure');
    expect(topics.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for unrelated text', () => {
    const topics = classifyTopics('xyz abc 123');
    expect(topics).toEqual([]);
  });

  it('is case insensitive', () => {
    const topics = classifyTopics('GOVERNMENT ELECTION LAW');
    expect(topics).toContain('politics');
  });

  it('sorts by relevance (most keyword matches first)', () => {
    // Politics should rank first with multiple keywords
    const topics = classifyTopics('government election minister law official assembly');
    expect(topics[0]).toBe('politics');
  });
});
