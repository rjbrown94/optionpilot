import { withMarketCache } from "./dataCache";

const MASSIVE_BASE_URL = "https://api.massive.com";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_RETRIES = 1;
const MIN_REQUEST_GAP_MS = 150;

type MassiveRequestOptions = {
  cacheKey?: string;
  ttlMilliseconds?: number;
  forceRefresh?: boolean;
  timeoutMilliseconds?: number;
};

type MassiveErrorPayload = {
  error?: string;
  message?: string;
  status?: string;
};

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForRequestSlot(): Promise<void> {
  const previousQueue = requestQueue;
  let releaseQueue!: () => void;

  requestQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previousQueue;

  const elapsed = Date.now() - lastRequestStartedAt;
  const waitTime = Math.max(0, MIN_REQUEST_GAP_MS - elapsed);

  if (waitTime > 0) {
    await sleep(waitTime);
  }

  lastRequestStartedAt = Date.now();
  releaseQueue();
}

function getApiKey(): string {
  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    throw new Error("MASSIVE_API_KEY is missing from .env.local.");
  }

  return apiKey;
}

function getRetryDelay(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  const parsedRetryAfter = Number(retryAfter);

  if (Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0) {
    return Math.min(parsedRetryAfter * 1000, 5_000);
  }

  return 1_000;
}

async function executeMassiveRequest<T>(
  path: string,
  searchParams: Record<string, string | number | boolean | undefined>,
  timeoutMilliseconds: number,
): Promise<T> {
  const url = new URL(path, MASSIVE_BASE_URL);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("apiKey", getApiKey());

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await waitForRequestSlot();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: T & MassiveErrorPayload;

      try {
        payload = JSON.parse(text) as T & MassiveErrorPayload;
      } catch {
        throw new Error(
          text ||
            `Massive returned invalid JSON with status ${response.status}.`,
        );
      }

      const message = payload.error || payload.message || "";
      const rateLimited =
        response.status === 429 ||
        message.toLowerCase().includes("maximum requests") ||
        message.toLowerCase().includes("rate limit");

      if (rateLimited && attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(response));
        continue;
      }

      if (!response.ok || payload.status === "ERROR" || payload.error) {
        throw new Error(
          payload.error ||
            payload.message ||
            `Massive returned HTTP ${response.status}.`,
        );
      }

      return payload;
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("Massive request failed.");

      lastError = normalizedError;

      const retryable =
        normalizedError.name === "AbortError" ||
        normalizedError.message.toLowerCase().includes("maximum requests") ||
        normalizedError.message.toLowerCase().includes("rate limit");

      if (!retryable || attempt >= MAX_RETRIES) {
        throw normalizedError;
      }

      await sleep(1_000);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Massive request failed.");
}

async function requestMassive<T>(
  path: string,
  searchParams: Record<string, string | number | boolean | undefined> = {},
  options: MassiveRequestOptions = {},
): Promise<T> {
  const {
    cacheKey,
    ttlMilliseconds = 60_000,
    forceRefresh = false,
    timeoutMilliseconds = DEFAULT_TIMEOUT_MS,
  } = options;

  const executeRequest = () =>
    executeMassiveRequest<T>(path, searchParams, timeoutMilliseconds);

  if (!cacheKey) {
    return executeRequest();
  }

  return withMarketCache<T>({
    key: cacheKey,
    ttlMilliseconds,
    forceRefresh,
    request: executeRequest,
  });
}

export async function getMassiveData<T>({
  path,
  searchParams,
  cacheKey,
  ttlMilliseconds,
  forceRefresh,
  timeoutMilliseconds,
}: {
  path: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
  cacheKey?: string;
  ttlMilliseconds?: number;
  forceRefresh?: boolean;
  timeoutMilliseconds?: number;
}): Promise<T> {
  return requestMassive<T>(path, searchParams, {
    cacheKey,
    ttlMilliseconds,
    forceRefresh,
    timeoutMilliseconds,
  });
}
