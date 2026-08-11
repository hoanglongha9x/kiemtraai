import {
  createHash,
} from "node:crypto";

import {
  ApiError,
} from "@/server/http/apiError";

const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_MODEL_SEQUENCE = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
] as const;

const DEFAULT_REQUESTS_PER_MINUTE =
  5;

const DEFAULT_CACHE_TTL_MS =
  1000 * 60 * 60 * 12;

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GenerateGeminiTextOptions = {
  parts: GeminiPart[];
  generationConfig?: Record<
    string,
    unknown
  >;
  cacheKeyParts?: unknown[];
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
};

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const requestTimestamps: number[] =
  [];

const responseCache =
  new Map<string, CacheEntry>();

function getModelSequence() {
  const configured =
    process.env.GEMINI_MODEL_SEQUENCE ||
    process.env.GEMINI_MODEL ||
    "";

  const models =
    configured
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

  return models.length > 0
    ? models
    : [...DEFAULT_MODEL_SEQUENCE];
}

function getRequestsPerMinute() {
  const parsed = Number(
    process.env.GEMINI_REQUESTS_PER_MINUTE
  );

  if (!Number.isFinite(parsed)) {
    return DEFAULT_REQUESTS_PER_MINUTE;
  }

  return Math.max(
    1,
    Math.trunc(parsed)
  );
}

function buildCacheKey(
  options: GenerateGeminiTextOptions
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        models: getModelSequence(),
        parts: options.cacheKeyParts ??
          options.parts,
        generationConfig:
          options.generationConfig ?? {},
      })
    )
    .digest("hex");
}

function readCachedResponse(
  key: string
) {
  const entry =
    responseCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCachedResponse(
  key: string,
  value: string
) {
  responseCache.set(key, {
    value,
    expiresAt:
      Date.now() +
      DEFAULT_CACHE_TTL_MS,
  });
}

function assertWithinRateLimit() {
  const now = Date.now();
  const windowStart =
    now - 60_000;

  while (
    requestTimestamps.length > 0 &&
    requestTimestamps[0] <
      windowStart
  ) {
    requestTimestamps.shift();
  }

  if (
    requestTimestamps.length >=
    getRequestsPerMinute()
  ) {
    throw new ApiError(
      "Hệ thống đang nhận nhiều yêu cầu AI. Vui lòng thử lại sau khoảng 1 phút.",
      429,
      {
        code: "AI_RATE_LIMITED",
      }
    );
  }

  requestTimestamps.push(now);
}

function isQuotaOrRateLimitError({
  httpStatus,
  providerStatus,
}: {
  httpStatus: number;
  providerStatus?: string;
}
) {
  return httpStatus === 429 ||
    providerStatus ===
      "RESOURCE_EXHAUSTED";
}

function getQuotaMessage() {
  return "Các model AI hiện đã hết hạn mức trong ngày. Vui lòng thử lại sau giờ reset quota.";
}

async function callGeminiModel({
  apiKey,
  model,
  options,
}: {
  apiKey: string;
  model: string;
  options: GenerateGeminiTextOptions;
}) {
  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: options.parts,
          },
        ],
        generationConfig:
          options.generationConfig,
      }),
    }
  );

  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    throw new ApiError(
      data.error?.message ||
        "Gemini API không xử lý được yêu cầu.",
      response.status,
      {
        code:
          isQuotaOrRateLimitError({
            httpStatus:
              response.status,
            providerStatus:
              data.error?.status,
          })
            ? "AI_QUOTA_EXHAUSTED"
            : undefined,
        details: {
          model,
          providerStatus:
            data.error?.status,
          providerCode:
            data.error?.code,
        },
      }
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

  if (!text) {
    throw new ApiError(
      "AI không trả về nội dung.",
      502,
      {
        details: {
          model,
        },
      }
    );
  }

  return text;
}

export async function generateGeminiText(
  options: GenerateGeminiTextOptions
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      "Chưa cấu hình GEMINI_API_KEY trong .env.local.",
      500
    );
  }

  const cacheKey =
    buildCacheKey(options);
  const cached =
    readCachedResponse(cacheKey);

  if (cached) {
    return {
      text: cached,
      model: "cache",
      cached: true,
    };
  }

  assertWithinRateLimit();

  const models =
    getModelSequence();
  let lastQuotaError:
    | ApiError
    | null = null;

  for (const model of models) {
    try {
      const text =
        await callGeminiModel({
          apiKey,
          model,
          options,
        });

      writeCachedResponse(
        cacheKey,
        text
      );

      return {
        text,
        model,
        cached: false,
      };
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code ===
          "AI_QUOTA_EXHAUSTED"
      ) {
        lastQuotaError = error;
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(
    getQuotaMessage(),
    429,
    {
      code: "AI_QUOTA_EXHAUSTED",
      details:
        lastQuotaError?.details,
    }
  );
}
