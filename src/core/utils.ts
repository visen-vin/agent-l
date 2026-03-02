export async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; initialDelay?: number; maxDelay?: number } = {}
): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000 } = options;
    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Don't retry on certain errors (e.g. 401 Unauthorized, 400 Bad Request)
            const errorMessage = error.message || '';
            const isRetryable = !errorMessage.includes('401') && !errorMessage.includes('400') && !errorMessage.includes('403');

            if (attempt === maxRetries || !isRetryable) {
                break;
            }

            console.warn(`Attempt ${attempt + 1} failed of ${maxRetries + 1}. Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, maxDelay);
        }
    }

    throw lastError;
}
