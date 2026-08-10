/**
 * Facebook Ad Library token rotation + rate-limit manager.
 * Extracted verbatim from the cron ingest route so scripts and the route share one impl.
 */

// Token status types
export type TokenStatus = 'active' | 'rate_limited' | 'expired' | 'invalid';

// Rate limit usage tracking from Facebook headers
interface RateLimitUsage {
  callCount: number;        // Percentage of calls used (0-100)
  totalCpuTime: number;     // Percentage of CPU time used (0-100)
  totalTime: number;        // Percentage of total time used (0-100)
  estimatedTimeToReset: number; // Minutes until reset
}

interface TokenState {
  status: TokenStatus;
  lastError?: string;
  rateLimitResetTime?: number;
  lastUsed?: Date;
  requestCount: number;
  usage?: RateLimitUsage;   // Current rate limit usage
}

// Threshold for proactive rotation (percentage)
const USAGE_ROTATION_THRESHOLD = 80;

// Token rotation manager with health tracking
export class TokenManager {
  private tokens: string[];
  private currentIndex: number = 0;
  private tokenStates: Map<number, TokenState> = new Map();

  constructor() {
    this.tokens = [];

    // Support multiple formats:
    // 1. FACEBOOK_ACCESS_TOKEN1, FACEBOOK_ACCESS_TOKEN2, etc.
    // 2. Comma-separated FACEBOOK_ACCESS_TOKENS
    // 3. Single FACEBOOK_ACCESS_TOKEN

    // Check for numbered tokens (TOKEN1, TOKEN2, etc.)
    for (let i = 1; i <= 10; i++) {
      const token = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
      if (token && token.trim()) {
        this.tokens.push(token.trim());
      }
    }

    // If no numbered tokens, try comma-separated
    if (this.tokens.length === 0) {
      const tokensEnv = process.env.FACEBOOK_ACCESS_TOKENS;
      if (tokensEnv) {
        this.tokens = tokensEnv.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    }

    // If still no tokens, try single token
    if (this.tokens.length === 0) {
      const singleToken = process.env.FACEBOOK_ACCESS_TOKEN;
      if (singleToken && singleToken.trim()) {
        this.tokens.push(singleToken.trim());
      }
    }

    // Initialize token states
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenStates.set(i, { status: 'active', requestCount: 0 });
    }

    console.log(`TokenManager initialized with ${this.tokens.length} token(s)`);
  }

  hasTokens(): boolean {
    return this.tokens.length > 0;
  }

  getToken(): string {
    if (this.tokens.length === 0) {
      throw new Error('No Facebook access tokens configured');
    }

    // Clear expired rate limits
    const now = Date.now();
    for (const [index, state] of this.tokenStates.entries()) {
      if (state.status === 'rate_limited' && state.rateLimitResetTime && now > state.rateLimitResetTime) {
        state.status = 'active';
        state.rateLimitResetTime = undefined;
        console.log(`Token ${index + 1} rate limit cleared, now active`);
      }
    }

    // Find an available token (prefer active, avoid expired/invalid)
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      const state = this.tokenStates.get(index);
      if (state && state.status === 'active') {
        this.currentIndex = index;
        state.lastUsed = new Date();
        state.requestCount++;
        return this.tokens[index];
      }
    }

    // Try rate-limited tokens (they might work with reduced load)
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      const state = this.tokenStates.get(index);
      if (state && state.status === 'rate_limited') {
        this.currentIndex = index;
        state.lastUsed = new Date();
        state.requestCount++;
        return this.tokens[index];
      }
    }

    // All tokens are expired/invalid - throw error
    throw new Error('All tokens are expired or invalid. Please update your Facebook access tokens.');
  }

  // Mark token as rate limited (temporary, will recover)
  markRateLimited(waitTimeMs: number = 60000): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'rate_limited';
      state.rateLimitResetTime = Date.now() + waitTimeMs;
      state.lastError = 'Rate limited';
      console.log(`Token ${this.currentIndex + 1}/${this.tokens.length} rate limited for ${waitTimeMs / 1000}s, rotating...`);
    }

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  // Mark token as expired (permanent until refreshed)
  markExpired(errorMessage?: string): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'expired';
      state.lastError = errorMessage || 'Token expired';
      console.log(`⚠️ Token ${this.currentIndex + 1}/${this.tokens.length} EXPIRED: ${errorMessage}`);
    }

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  // Mark token as invalid (wrong permissions, etc.)
  markInvalid(errorMessage?: string): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'invalid';
      state.lastError = errorMessage || 'Token invalid';
      console.log(`⚠️ Token ${this.currentIndex + 1}/${this.tokens.length} INVALID: ${errorMessage}`);
    }

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  getCurrentTokenIndex(): number {
    return this.currentIndex + 1; // 1-indexed for logging
  }

  getTotalTokens(): number {
    return this.tokens.length;
  }

  allTokensRateLimited(): boolean {
    for (const state of this.tokenStates.values()) {
      if (state.status === 'active') return false;
    }
    return true;
  }

  // Check if any tokens are still usable
  hasUsableTokens(): boolean {
    for (const state of this.tokenStates.values()) {
      if (state.status === 'active' || state.status === 'rate_limited') return true;
    }
    return false;
  }

  // Get status summary for API response
  getStatusSummary(): {
    total: number;
    active: number;
    rateLimited: number;
    expired: number;
    invalid: number;
    details: Array<{
      token: number;
      status: TokenStatus;
      error?: string;
      requestCount: number;
      usage?: { call: number; cpu: number; time: number };
    }>;
  } {
    let active = 0, rateLimited = 0, expired = 0, invalid = 0;
    const details: Array<{
      token: number;
      status: TokenStatus;
      error?: string;
      requestCount: number;
      usage?: { call: number; cpu: number; time: number };
    }> = [];

    for (const [index, state] of this.tokenStates.entries()) {
      switch (state.status) {
        case 'active': active++; break;
        case 'rate_limited': rateLimited++; break;
        case 'expired': expired++; break;
        case 'invalid': invalid++; break;
      }
      details.push({
        token: index + 1,
        status: state.status,
        error: state.lastError,
        requestCount: state.requestCount,
        usage: state.usage ? {
          call: state.usage.callCount,
          cpu: state.usage.totalCpuTime,
          time: state.usage.totalTime,
        } : undefined,
      });
    }

    return { total: this.tokens.length, active, rateLimited, expired, invalid, details };
  }

  // Reset all token states (useful after updating tokens)
  resetStates(): void {
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenStates.set(i, { status: 'active', requestCount: 0 });
    }
    this.currentIndex = 0;
    console.log('TokenManager states reset');
  }

  // Update usage from Facebook response headers
  // Returns true if we should rotate to a different token
  updateUsageFromHeaders(headers: Headers): boolean {
    const state = this.tokenStates.get(this.currentIndex);
    if (!state) return false;

    // Facebook sends rate limit info in these headers (JSON format)
    // x-business-use-case-usage: {"app_id":{"call_count":X,"total_cputime":Y,"total_time":Z}}
    // x-app-usage: {"call_count":X,"total_cputime":Y,"total_time":Z}
    // x-ad-account-usage: {"acc_id_util_pct":X}

    let usage: RateLimitUsage | undefined;

    // Try x-app-usage first (simpler format)
    const appUsage = headers.get('x-app-usage');
    if (appUsage) {
      try {
        const parsed = JSON.parse(appUsage);
        usage = {
          callCount: parsed.call_count || 0,
          totalCpuTime: parsed.total_cputime || 0,
          totalTime: parsed.total_time || 0,
          estimatedTimeToReset: parsed.estimated_time_to_regain_access || 0,
        };
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Try x-business-use-case-usage (nested format)
    if (!usage) {
      const businessUsage = headers.get('x-business-use-case-usage');
      if (businessUsage) {
        try {
          const parsed = JSON.parse(businessUsage);
          // This is nested by app_id or ad_account_id, get first entry
          const firstKey = Object.keys(parsed)[0];
          if (firstKey && Array.isArray(parsed[firstKey]) && parsed[firstKey][0]) {
            const data = parsed[firstKey][0];
            usage = {
              callCount: data.call_count || 0,
              totalCpuTime: data.total_cputime || 0,
              totalTime: data.total_time || 0,
              estimatedTimeToReset: data.estimated_time_to_regain_access || 0,
            };
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    if (usage) {
      state.usage = usage;
      const maxUsage = Math.max(usage.callCount, usage.totalCpuTime, usage.totalTime);

      // Log when usage is getting high
      if (maxUsage >= 50) {
        console.log(`Token ${this.currentIndex + 1} usage: ${maxUsage}% (call: ${usage.callCount}%, cpu: ${usage.totalCpuTime}%, time: ${usage.totalTime}%)`);
      }

      // Proactively rotate if usage is above threshold
      if (maxUsage >= USAGE_ROTATION_THRESHOLD) {
        console.log(`⚡ Token ${this.currentIndex + 1} at ${maxUsage}% usage, proactively rotating...`);

        // Find a token with lower usage
        const currentMaxUsage = maxUsage;
        for (let i = 1; i < this.tokens.length; i++) {
          const nextIndex = (this.currentIndex + i) % this.tokens.length;
          const nextState = this.tokenStates.get(nextIndex);
          if (nextState && nextState.status === 'active') {
            const nextMaxUsage = nextState.usage
              ? Math.max(nextState.usage.callCount, nextState.usage.totalCpuTime, nextState.usage.totalTime)
              : 0;

            // Only rotate if next token has significantly lower usage
            if (nextMaxUsage < currentMaxUsage - 20) {
              this.currentIndex = nextIndex;
              console.log(`Switched to token ${nextIndex + 1} (${nextMaxUsage}% usage)`);
              return true;
            }
          }
        }

        // No better token found, continue with current
        console.log(`No better token available, continuing with token ${this.currentIndex + 1}`);
      }
    }

    return false;
  }

  // Get the best available token (lowest usage)
  getBestToken(): string {
    if (this.tokens.length === 0) {
      throw new Error('No Facebook access tokens configured');
    }

    // Clear expired rate limits first
    const now = Date.now();
    for (const [index, state] of this.tokenStates.entries()) {
      if (state.status === 'rate_limited' && state.rateLimitResetTime && now > state.rateLimitResetTime) {
        state.status = 'active';
        state.rateLimitResetTime = undefined;
        state.usage = undefined; // Clear usage on reset
        console.log(`Token ${index + 1} rate limit cleared, now active`);
      }
    }

    // Find active token with lowest usage
    let bestIndex = -1;
    let lowestUsage = Infinity;

    for (let i = 0; i < this.tokens.length; i++) {
      const state = this.tokenStates.get(i);
      if (state && state.status === 'active') {
        const maxUsage = state.usage
          ? Math.max(state.usage.callCount, state.usage.totalCpuTime, state.usage.totalTime)
          : 0;

        if (maxUsage < lowestUsage) {
          lowestUsage = maxUsage;
          bestIndex = i;
        }
      }
    }

    if (bestIndex >= 0) {
      this.currentIndex = bestIndex;
      const state = this.tokenStates.get(bestIndex)!;
      state.lastUsed = new Date();
      state.requestCount++;
      return this.tokens[bestIndex];
    }

    // Fallback to regular getToken() logic
    return this.getToken();
  }
}
