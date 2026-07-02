/**
 * AI Claim Extraction Types
 *
 * Types for the claim extraction API that uses OpenAI to identify
 * verifiable, factual claims from text.
 */

/**
 * An extracted claim from text.
 */
export interface ExtractedClaim {
  /** The extracted claim statement, concise and standalone */
  claim: string;
  /** Whether this claim can be fact-checked with evidence */
  checkable: boolean;
  /** The topic category of the claim */
  topic: string;
  /** Time reference if present (e.g., "since 2020", "last month") */
  timeframe: string | null;
  /** Named entities mentioned (people, organizations, places) */
  entities: string[];
  /** The original source phrase from the input text */
  original_text: string;
}

/**
 * Request body for the extract-claims API.
 */
export interface ExtractClaimsRequest {
  text: string;
}

/**
 * Response from the extract-claims API.
 */
export interface ExtractClaimsResponse {
  claims: ExtractedClaim[];
}

/**
 * Error response from the extract-claims API.
 */
export interface ExtractClaimsError {
  error: string;
}
