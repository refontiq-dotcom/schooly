/**
 * TROUVETOU — fetch avec retry (couche 1 de fiabilité)
 *
 * Identique au helper utilisé côté Séjoura (src/lib/trouvetou/fetch-with-retry.ts) :
 * retry sur erreur réseau et HTTP 5xx/408/429, jamais sur 4xx, backoff court
 * (800ms puis 2000ms) pour rester sous les timeouts serverless.
 */

export interface RetryResult {
  response: Response | null;
  attempts: number;
  lastError: Error | null;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_DELAYS_MS = [800, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  delays: number[] = DEFAULT_DELAYS_MS
): Promise<RetryResult> {
  const maxAttempts = delays.length + 1;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);

      if (!RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts) {
        if (attempt > 1) {
          console.warn(
            `[trouvetou-sync] Réussi après ${attempt} tentative(s) (HTTP ${response.status}).`
          );
        }
        return { response, attempts: attempt, lastError: null };
      }

      console.warn(
        `[trouvetou-sync] Tentative ${attempt}/${maxAttempts} : HTTP ${response.status}, nouvel essai dans ${delays[attempt - 1]}ms.`
      );
      await sleep(delays[attempt - 1]);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) {
        console.warn(
          `[trouvetou-sync] Échec définitif après ${attempt} tentative(s) : ${lastError.message}`
        );
        return { response: null, attempts: attempt, lastError };
      }

      console.warn(
        `[trouvetou-sync] Tentative ${attempt}/${maxAttempts} : erreur réseau "${lastError.message}", nouvel essai dans ${delays[attempt - 1]}ms.`
      );
      await sleep(delays[attempt - 1]);
    }
  }

  return { response: null, attempts: maxAttempts, lastError };
}
