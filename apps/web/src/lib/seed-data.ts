/**
 * Seed data for development and demos.
 *
 * Inspired by real investigative journalism from Efecto Cocuyo.
 * https://efectococuyo.com/cocuyo-chequea/maquinaria-eco-44-medios/
 *
 * Supports both English and Spanish locales.
 */

import type {
  Post,
  PostId,
  StoryChain,
  ChainId,
  Campaign,
  CampaignId,
  Corroboration,
  CorroborationId,
  Claim,
  ClaimId,
  FireflyProfileUpdate,
} from '@cocuyo/types';
import {
  createPostId,
  createChainId,
  createCampaignId,
  createCorroborationId,
  createClaimId,
  createDIMCredential,
  createPUSDAmount,
  createEscrowId,
  createTransactionHash,
  createOutletId,
  emptyCorroborationSummary,
} from '@cocuyo/types';

type Locale = 'en' | 'es';

// Fixed IDs for seed data
const POST_1_ID = createPostId('seed-post-001');
const POST_2_ID = createPostId('seed-post-002');
const POST_3_ID = createPostId('seed-post-003');
const CHAIN_1_ID = createChainId('seed-chain-001');
const CAMPAIGN_1_ID = createCampaignId('seed-campaign-001');
const CORR_1_ID = createCorroborationId('seed-corr-001');
const CORR_2_ID = createCorroborationId('seed-corr-002');
const CLAIM_1_ID = createClaimId('seed-claim-001');
const OUTLET_EFECTO_COCUYO_ID = createOutletId('outlet-efecto-cocuyo');

const DIM_CREDENTIAL_1 = createDIMCredential('dim-seed-user-001');
const DIM_CREDENTIAL_2 = createDIMCredential('dim-seed-user-002');
const DIM_CREDENTIAL_3 = createDIMCredential('dim-seed-user-003');

// Fixed timestamps for seed data (won't go stale after deployment)
// Based on the Efecto Cocuyo investigation timeline - March 2025
const MARCH_15_2025 = new Date('2025-03-15T10:00:00Z').getTime();
const MARCH_16_2025 = new Date('2025-03-16T14:30:00Z').getTime();
const MARCH_17_2025 = new Date('2025-03-17T09:15:00Z').getTime();
const MARCH_18_2025 = new Date('2025-03-18T16:00:00Z').getTime();
const APRIL_15_2025 = new Date('2025-04-15T12:00:00Z').getTime(); // Campaign expiry

// ============================================================================
// Localized Content
// ============================================================================

const localizedContent = {
  post1: {
    en: {
      title: '44 media outlets amplify Venezuelan government narratives',
      text: 'A collaborative investigation by ProBox, Cazadores de Fake News, Efecto Cocuyo, and Medianálisis reveals a coordinated network of 44 media outlets that systematically amplify the narratives and propaganda of the Venezuelan government. The network includes state media (VTV), supposedly independent portals, and international media from Russia, China, Iran, and the United States.',
    },
    es: {
      title: '44 medios amplifican narrativas del gobierno venezolano',
      text: 'Una investigación colaborativa de ProBox, Cazadores de Fake News, Efecto Cocuyo y Medianálisis revela una red coordinada de 44 medios que sistemáticamente amplifican las narrativas y propaganda del gobierno venezolano. La red incluye medios estatales (VTV), portales supuestamente independientes, y medios internacionales de Rusia, China, Irán y Estados Unidos.',
    },
  },
  post2: {
    en: {
      title: '132 identical publications between El Universal and Globovisión',
      text: 'We documented 132 shared publications between El Universal and Globovisión with nearly identical headlines, text, and structure. This content replication pattern is consistent with a coordinated amplification operation.',
    },
    es: {
      title: '132 publicaciones idénticas entre El Universal y Globovisión',
      text: 'Documentamos 132 publicaciones compartidas entre El Universal y Globovisión con titulares, texto y estructura casi idénticos. Este patrón de replicación de contenido es consistente con una operación de amplificación coordinada.',
    },
  },
  post3: {
    en: {
      text: 'During the monitoring period, 30,948 mentions were recorded on social networks. X (Twitter) represented 45.06% of the discussion. Three synchronized hashtag campaigns were identified: #HandsOffVenezuela, #VenezuelaNoSeRinde, and #PuebloLevantaLaCara.',
    },
    es: {
      text: 'Durante el período de monitoreo se registraron 30,948 menciones en redes sociales. X (Twitter) representó el 45.06% de la discusión. Se identificaron tres campañas de hashtags sincronizados: #HandsOffVenezuela, #VenezuelaNoSeRinde, y #PuebloLevantaLaCara.',
    },
  },
  chain1: {
    en: {
      title: '#TheEchoMachine',
      description:
        "Investigation into how 44 media outlets globalize the Venezuelan regime's narrative. Collaborative tracking of the propaganda amplification network.",
    },
    es: {
      title: '#LaMaquinariaDelEco',
      description:
        'Investigación sobre cómo 44 medios globalizan la narrativa del régimen venezolano. Seguimiento colaborativo de la red de amplificación de propaganda.',
    },
  },
  campaign1: {
    en: {
      title: 'Identify funding sources for the media network',
      description:
        'We are looking for documented evidence about the funding sources of the 44 media outlets identified in the #TheEchoMachine investigation. We are especially interested in documenting advertising contracts with state entities, international transfers, or corporate links.',
    },
    es: {
      title: 'Identificar fuentes de financiamiento de la red de medios',
      description:
        'Buscamos evidencia documentada sobre las fuentes de financiamiento de los 44 medios identificados en la investigación #LaMaquinariaDelEco. Interesa especialmente documentar contratos publicitarios con entidades estatales, transferencias internacionales, o vínculos corporativos.',
    },
  },
  corroboration1: {
    en: {
      evidenceDescription: 'Complete ProBox report with methodology and analysis data',
    },
    es: {
      evidenceDescription: 'Informe completo de ProBox con metodología y datos del análisis',
    },
  },
  corroboration2: {
    en: {
      evidenceContent:
        'I work in digital media in Venezuela. I have personally observed how similar content guidelines arrive at different newsrooms simultaneously.',
    },
    es: {
      evidenceContent:
        'Trabajo en medios digitales en Venezuela. He observado personalmente cómo llegan pautas de contenido similares a diferentes redacciones simultáneamente.',
    },
  },
  claim1: {
    en: {
      statement:
        '44 media outlets participate in a coordinated network to amplify Venezuelan government narratives',
    },
    es: {
      statement:
        '44 medios participan en una red coordinada de amplificación de narrativas del gobierno venezolano',
    },
  },
};

// ============================================================================
// Outlets
// ============================================================================

// ============================================================================
// Factory Functions
// ============================================================================

function createPost1(locale: Locale): Post {
  const content = localizedContent.post1[locale];
  return {
    id: POST_1_ID,
    author: {
      id: 'seed-author-001',
      credentialHash: DIM_CREDENTIAL_1,
      pseudonym: 'MediaWatcher',
      disclosureLevel: 'anonymous',
      location: 'Caracas',
    },
    content: {
      title: content.title,
      text: content.text,
      links: ['https://efectococuyo.com/cocuyo-chequea/maquinaria-eco-44-medios/'],
    },
    context: {
      topics: ['media', 'disinformation', 'venezuela'],
      locationName: 'Venezuela',
      location: { latitude: 10.4806, longitude: -66.9036 },
    },
    dimSignature: DIM_CREDENTIAL_1,
    status: 'published',
    chainLinks: [CHAIN_1_ID],
    corroborations: {
      witnessCount: 2,
      evidenceCount: 3,
      expertiseCount: 1,
      challengeCount: 0,
    },
    verification: { status: 'unverified' },
    createdAt: MARCH_15_2025,
  };
}

function createPost2(locale: Locale): Post {
  const content = localizedContent.post2[locale];
  return {
    id: POST_2_ID,
    author: {
      id: 'seed-author-002',
      credentialHash: DIM_CREDENTIAL_2,
      pseudonym: 'DataAnalyst',
      disclosureLevel: 'anonymous',
    },
    content: {
      title: content.title,
      text: content.text,
    },
    context: {
      topics: ['media', 'disinformation', 'venezuela'],
      locationName: 'Venezuela',
    },
    dimSignature: DIM_CREDENTIAL_2,
    status: 'published',
    chainLinks: [CHAIN_1_ID],
    corroborations: {
      witnessCount: 0,
      evidenceCount: 2,
      expertiseCount: 0,
      challengeCount: 0,
    },
    verification: { status: 'unverified' },
    createdAt: MARCH_16_2025,
  };
}

function createPost3(locale: Locale): Post {
  const content = localizedContent.post3[locale];
  return {
    id: POST_3_ID,
    author: {
      id: 'seed-author-003',
      credentialHash: DIM_CREDENTIAL_3,
      pseudonym: 'SocialMonitor',
      disclosureLevel: 'anonymous',
    },
    content: {
      text: content.text,
    },
    context: {
      topics: ['social-media', 'disinformation', 'venezuela'],
    },
    dimSignature: DIM_CREDENTIAL_3,
    status: 'published',
    chainLinks: [CHAIN_1_ID],
    corroborations: emptyCorroborationSummary(),
    verification: { status: 'unverified' },
    createdAt: MARCH_17_2025,
  };
}

function createStoryChain1(locale: Locale): StoryChain {
  const content = localizedContent.chain1[locale];
  return {
    id: CHAIN_1_ID,
    title: content.title,
    description: content.description,
    topics: ['media', 'disinformation', 'venezuela'],
    status: 'emerging',
    postIds: [POST_1_ID, POST_2_ID, POST_3_ID],
    stats: {
      postCount: 3,
      corroborationCount: 8,
      challengeCount: 0,
      contributorCount: 3,
    },
    createdAt: MARCH_15_2025,
    updatedAt: MARCH_17_2025,
  };
}

function createCampaign1(locale: Locale): Campaign {
  const content = localizedContent.campaign1[locale];
  return {
    id: CAMPAIGN_1_ID,
    title: content.title,
    description: content.description,
    topics: ['media', 'disinformation', 'venezuela', 'finance'],
    sponsor: {
      type: 'outlet',
      id: OUTLET_EFECTO_COCUYO_ID,
      name: 'Efecto Cocuyo',
    },
    fundingAmount: createPUSDAmount(BigInt(50000)), // $500.00
    escrowId: createEscrowId('escrow-seed-001'),
    fundingTxHash: createTransactionHash('0xseed001'),
    contributingPostIds: [POST_1_ID],
    deliverables: [
      { type: 'evidence_gathered', target: 10, current: 3 },
      { type: 'sources_verified', target: 5, current: 1 },
    ],
    status: 'active',
    payoutMode: 'public',
    createdAt: MARCH_18_2025,
    expiresAt: APRIL_15_2025,
  };
}

function createCorroboration1(locale: Locale): Corroboration {
  const content = localizedContent.corroboration1[locale];
  return {
    id: CORR_1_ID,
    postId: POST_1_ID,
    type: 'evidence',
    dimSignature: DIM_CREDENTIAL_2,
    quality: 'documented',
    createdAt: MARCH_16_2025,
    evidenceType: 'source_link',
    evidenceContent: 'https://probox.org/investigacion-maquinaria-eco',
    evidenceDescription: content.evidenceDescription,
  };
}

function createCorroboration2(locale: Locale): Corroboration {
  const content = localizedContent.corroboration2[locale];
  return {
    id: CORR_2_ID,
    postId: POST_1_ID,
    type: 'witness',
    dimSignature: DIM_CREDENTIAL_3,
    quality: 'observation',
    createdAt: MARCH_17_2025,
    evidenceType: 'observation',
    evidenceContent: content.evidenceContent,
  };
}

function createClaim1(locale: Locale): Claim {
  const content = localizedContent.claim1[locale];
  return {
    id: CLAIM_1_ID,
    statement: content.statement,
    sourcePostId: POST_1_ID,
    extractedBy: DIM_CREDENTIAL_1,
    topics: ['media', 'disinformation', 'venezuela'],
    evidence: [],
    status: 'under_review',
    createdAt: MARCH_15_2025,
    updatedAt: MARCH_16_2025,
  };
}

// ============================================================================
// Localized Getters
// ============================================================================

export function getSeedPostsForLocale(locale: Locale): Map<PostId, Post> {
  return new Map<PostId, Post>([
    [POST_1_ID, createPost1(locale)],
    [POST_2_ID, createPost2(locale)],
    [POST_3_ID, createPost3(locale)],
  ]);
}

export function getSeedStoryChainsForLocale(locale: Locale): Map<ChainId, StoryChain> {
  return new Map<ChainId, StoryChain>([[CHAIN_1_ID, createStoryChain1(locale)]]);
}

export function getSeedCampaignsForLocale(locale: Locale): Map<CampaignId, Campaign> {
  return new Map<CampaignId, Campaign>([[CAMPAIGN_1_ID, createCampaign1(locale)]]);
}

export function getSeedCorroborationsForLocale(
  locale: Locale
): Map<CorroborationId, Corroboration> {
  return new Map<CorroborationId, Corroboration>([
    [CORR_1_ID, createCorroboration1(locale)],
    [CORR_2_ID, createCorroboration2(locale)],
  ]);
}

export function getSeedClaimsForLocale(locale: Locale): Map<ClaimId, Claim> {
  return new Map<ClaimId, Claim>([[CLAIM_1_ID, createClaim1(locale)]]);
}

// ============================================================================
// Default Exports (English for backwards compatibility)
// ============================================================================

export const seedPosts = getSeedPostsForLocale('en');
export const seedStoryChains = getSeedStoryChainsForLocale('en');
export const seedCampaigns = getSeedCampaignsForLocale('en');
export const seedCorroborations = getSeedCorroborationsForLocale('en');
export const seedClaims = getSeedClaimsForLocale('en');

// Derived mappings (locale-independent)
export const seedPostClaims = new Map<PostId, ClaimId[]>([[POST_1_ID, [CLAIM_1_ID]]]);

export const seedPostCorroborations = new Map<PostId, CorroborationId[]>([
  [POST_1_ID, [CORR_1_ID, CORR_2_ID]],
]);

export const seedPostCampaigns = new Map<PostId, CampaignId[]>([[POST_1_ID, [CAMPAIGN_1_ID]]]);

export const seedCampaignPosts = new Map<CampaignId, PostId[]>([[CAMPAIGN_1_ID, [POST_1_ID]]]);

// Export IDs for use in generateStaticParams
export const SEED_CAMPAIGN_IDS = ['seed-campaign-001'];

// ============================================================================
// Seed Credentials and Profile Data
// ============================================================================

/**
 * Credential ID strings for use in generateStaticParams.
 */
export const SEED_CREDENTIAL_IDS = ['dim-seed-user-001', 'dim-seed-user-002', 'dim-seed-user-003'];

/**
 * Localized profile data for seed users.
 * Contains only editable fields - system fields are derived at runtime.
 */
const seedProfileData = {
  'dim-seed-user-001': {
    en: {
      pseudonym: 'MediaWatcher',
      disclosureLevel: 'partial' as const,
      publicInfo: {
        location: 'Caracas, Venezuela',
        bio: 'Monitoring media narratives and documenting disinformation patterns across Latin America.',
      },
    },
    es: {
      pseudonym: 'MediaWatcher',
      disclosureLevel: 'partial' as const,
      publicInfo: {
        location: 'Caracas, Venezuela',
        bio: 'Monitoreando narrativas mediáticas y documentando patrones de desinformación en América Latina.',
      },
    },
  },
  'dim-seed-user-002': {
    en: {
      pseudonym: 'DataAnalyst',
      disclosureLevel: 'anonymous' as const,
    },
    es: {
      pseudonym: 'DataAnalyst',
      disclosureLevel: 'anonymous' as const,
    },
  },
  'dim-seed-user-003': {
    en: {
      pseudonym: 'SocialMonitor',
      disclosureLevel: 'public' as const,
      publicInfo: {
        displayName: 'Social Media Research Team',
        location: 'Remote',
        bio: 'Tracking coordinated social media campaigns and analyzing engagement patterns.',
      },
    },
    es: {
      pseudonym: 'SocialMonitor',
      disclosureLevel: 'public' as const,
      publicInfo: {
        displayName: 'Equipo de Investigación de Redes Sociales',
        location: 'Remoto',
        bio: 'Rastreando campañas coordinadas en redes sociales y analizando patrones de engagement.',
      },
    },
  },
};

/**
 * Get profile data for a seed credential.
 * Returns null if credential is not a seed user.
 */
export function getSeedProfileData(
  credentialId: string,
  locale: Locale
): FireflyProfileUpdate | null {
  if (!(credentialId in seedProfileData)) return null;
  const profile = seedProfileData[credentialId as keyof typeof seedProfileData];
  return profile[locale];
}
