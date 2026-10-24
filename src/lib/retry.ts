interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean; // default: retry every error
}

/**
 * Wraps a fetch function with exponential backoff retry logic.
 * Includes jitter to prevent thundering herd problem.
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
    shouldRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || (shouldRetry && !shouldRetry(lastError))) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 100;
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + jitter,
        maxDelay
      );

      onRetry?.(attempt + 1, lastError);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Unexpected: exceeded retry loop');
}
