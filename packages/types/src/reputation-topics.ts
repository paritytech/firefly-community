/**
 * Reputation topic taxonomy — domains for topic-weighted reputation.
 *
 * Fireflies build reputation within specific domains. A journalist
 * covering economic issues builds economy reputation; a healthcare
 * worker builds health reputation. This prevents gaming and ensures
 * corroborations carry appropriate weight.
 */

/**
 * Reputation topic domains.
 *
 * This taxonomy is intentionally narrow to start. Topics should be:
 * - Broad enough to accumulate meaningful reputation
 * - Specific enough to be meaningful for corroboration weighting
 * - Relevant to investigative journalism and civic intelligence
 */
export type ReputationTopic =
  | 'economy' // Prices, inflation, employment, business
  | 'health' // Healthcare, hospitals, medicine, public health
  | 'politics' // Government, elections, officials, policy
  | 'infrastructure' // Utilities, roads, public services, transport
  | 'human-rights' // Detention, press freedom, protests, civil liberties
  | 'environment' // Pollution, water, land use, climate
  | 'security' // Crime, safety, policing, conflict
  | 'education'; // Schools, universities, access, quality

/**
 * All reputation topics as an array (for iteration).
 */
export const REPUTATION_TOPICS: readonly ReputationTopic[] = [
  'economy',
  'health',
  'politics',
  'infrastructure',
  'human-rights',
  'environment',
  'security',
  'education',
] as const;

/**
 * Metadata for each reputation topic.
 */
export interface TopicMetadata {
  /** Machine-readable identifier */
  readonly id: ReputationTopic;
  /** Display label (English) */
  readonly label: string;
  /** Brief description */
  readonly description: string;
  /** Related keywords for classification */
  readonly keywords: readonly string[];
}

/**
 * Topic metadata registry.
 */
export const TOPIC_METADATA: Readonly<Record<ReputationTopic, TopicMetadata>> = {
  economy: {
    id: 'economy',
    label: 'Economy',
    description: 'Prices, inflation, employment, and business conditions',
    keywords: ['price', 'inflation', 'salary', 'job', 'business', 'market', 'currency', 'food'],
  },
  health: {
    id: 'health',
    label: 'Health',
    description: 'Healthcare access, hospitals, medicine, and public health',
    keywords: ['hospital', 'medicine', 'doctor', 'clinic', 'disease', 'vaccine', 'pharmacy'],
  },
  politics: {
    id: 'politics',
    label: 'Politics',
    description: 'Government actions, elections, officials, and policy',
    keywords: ['election', 'government', 'minister', 'law', 'decree', 'assembly', 'official'],
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    description: 'Utilities, roads, public services, and transportation',
    keywords: ['electricity', 'water', 'road', 'transport', 'internet', 'gas', 'outage'],
  },
  'human-rights': {
    id: 'human-rights',
    label: 'Human Rights',
    description: 'Detention, press freedom, protests, and civil liberties',
    keywords: ['arrest', 'detention', 'protest', 'journalist', 'freedom', 'activist', 'rights'],
  },
  environment: {
    id: 'environment',
    label: 'Environment',
    description: 'Pollution, water quality, land use, and climate impacts',
    keywords: ['pollution', 'water', 'air', 'contamination', 'mining', 'deforestation', 'flood'],
  },
  security: {
    id: 'security',
    label: 'Security',
    description: 'Crime, public safety, policing, and conflict',
    keywords: ['crime', 'police', 'violence', 'theft', 'safety', 'gang', 'conflict'],
  },
  education: {
    id: 'education',
    label: 'Education',
    description: 'Schools, universities, access, and quality',
    keywords: ['school', 'university', 'teacher', 'student', 'class', 'education', 'learning'],
  },
} as const;

/**
 * Check if a string is a valid reputation topic.
 */
export function isReputationTopic(value: string): value is ReputationTopic {
  return REPUTATION_TOPICS.includes(value as ReputationTopic);
}

/**
 * Get metadata for a topic.
 */
export function getTopicMetadata(topic: ReputationTopic): TopicMetadata {
  return TOPIC_METADATA[topic];
}

/**
 * Attempt to classify text into relevant topics based on keywords.
 * Returns topics sorted by relevance (most keywords matched first).
 */
export function classifyTopics(text: string): ReputationTopic[] {
  const lowerText = text.toLowerCase();
  const scores: Array<{ topic: ReputationTopic; score: number }> = [];

  for (const topic of REPUTATION_TOPICS) {
    const metadata = TOPIC_METADATA[topic];
    let score = 0;
    for (const keyword of metadata.keywords) {
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores.push({ topic, score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores.map((s) => s.topic);
}
