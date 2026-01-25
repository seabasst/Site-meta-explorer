/**
 * Custom error class for API errors with additional context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Maps technical error messages to user-friendly text.
 * Called by error display components to sanitize error output.
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Handle known API errors
    if (error.code === 'RATE_LIMIT') {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.code === 'AUTH_ERROR') {
      return 'Unable to connect to Facebook. Please try again later.';
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Facebook-specific errors
    if (msg.includes('facebook_access_token') || msg.includes('access token')) {
      return 'Unable to connect to Facebook. Please try again later.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (msg.includes('page id') || msg.includes('view_all_page_id')) {
      return 'Invalid Ad Library URL. Please paste a URL with a page ID.';
    }

    // Network errors
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused')) {
      return 'Network connection issue. Please check your internet and try again.';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'The request took too long. Please try again.';
    }

    // Generic server errors
    if (msg.includes('500') || msg.includes('internal server')) {
      return 'Something went wrong on our end. Please try again.';
    }
  }

  // Default fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Non-retryable: validation errors, auth errors, 4xx client errors
    if (msg.includes('invalid url') || msg.includes('page id')) {
      return false;
    }
    // Retryable: network, timeout, server errors
    return true;
  }

  return true;
}
