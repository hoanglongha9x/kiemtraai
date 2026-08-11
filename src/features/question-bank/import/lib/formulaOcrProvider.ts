export type FormulaOcrProvider =
  | "pp-formulanet"
  | "mathpix"
  | "none";

export type FormulaOcrInput = {
  id: string;
  buffer: Buffer;
  mimeType?: string;
};

export type FormulaOcrResult = {
  id: string;
  latex: string;
  confidence: number;
  provider: Exclude<
    FormulaOcrProvider,
    "none"
  >;
};

export type FormulaOcrConfig = {
  ppFormulaOcrUrl?: string;
  mathpixAppId?: string;
  mathpixAppKey?: string;
  mathpixEndpoint?: string;
};

function clampConfidence(
  value: unknown
) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(0, numeric)
  );
}

function normalizeLatex(
  value: unknown
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/^```(?:latex|tex)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function selectFormulaOcrProvider(
  config: FormulaOcrConfig
): FormulaOcrProvider {
  if (
    config.ppFormulaOcrUrl?.trim()
  ) {
    return "pp-formulanet";
  }

  if (
    config.mathpixAppId?.trim() &&
    config.mathpixAppKey?.trim()
  ) {
    return "mathpix";
  }

  return "none";
}

function getDefaultConfig(): FormulaOcrConfig {
  return {
    ppFormulaOcrUrl:
      process.env
        .PP_FORMULA_OCR_URL,
    mathpixAppId:
      process.env.MATHPIX_APP_ID,
    mathpixAppKey:
      process.env
        .MATHPIX_APP_KEY,
    mathpixEndpoint:
      process.env
        .MATHPIX_OCR_ENDPOINT,
  };
}

async function recognizeWithPpFormulaNet({
  inputs,
  endpoint,
}: {
  inputs: FormulaOcrInput[];
  endpoint: string;
}): Promise<FormulaOcrResult[]> {
  const response = await fetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        output_format: "latex",
        images: inputs.map(
          (input) => ({
            id: input.id,
            mime_type:
              input.mimeType ??
              "image/png",
            image_base64:
              input.buffer.toString(
                "base64"
              ),
          })
        ),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `PP-FormulaNet trả HTTP ${response.status}.`
    );
  }

  const payload =
    (await response.json()) as
      unknown;
  const rawResults = Array.isArray(
    payload
  )
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray(
          (
            payload as Record<
              string,
              unknown
            >
          ).results
        )
      ? ((
          payload as Record<
            string,
            unknown
          >
        ).results as unknown[])
      : [];

  return rawResults.flatMap(
    (entry) => {
      if (
        !entry ||
        typeof entry !== "object"
      ) {
        return [];
      }

      const record = entry as Record<
        string,
        unknown
      >;
      const id = String(
        record.id ?? ""
      ).trim();
      const latex = normalizeLatex(
        record.latex ??
          record.rec_formula ??
          record.text
      );

      return id && latex
        ? [
            {
              id,
              latex,
              confidence:
                clampConfidence(
                  record.confidence ??
                    record.score
                ),
              provider:
                "pp-formulanet" as const,
            },
          ]
        : [];
    }
  );
}

async function recognizeMathpixImage({
  input,
  appId,
  appKey,
  endpoint,
}: {
  input: FormulaOcrInput;
  appId: string;
  appKey: string;
  endpoint: string;
}): Promise<FormulaOcrResult | null> {
  const mimeType =
    input.mimeType ??
    "image/png";
  const response = await fetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        app_id: appId,
        app_key: appKey,
      },
      body: JSON.stringify({
        src: `data:${mimeType};base64,${input.buffer.toString(
          "base64"
        )}`,
        formats: [
          "text",
          "latex_styled",
        ],
        data_options: {
          include_latex: true,
          include_mathml: false,
          include_asciimath:
            false,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Mathpix trả HTTP ${response.status}.`
    );
  }

  const payload =
    (await response.json()) as
      Record<string, unknown>;
  const latex = normalizeLatex(
    payload.latex_styled ??
      payload.text
  );

  if (!latex) {
    return null;
  }

  return {
    id: input.id,
    latex,
    confidence:
      clampConfidence(
        payload.confidence ??
          payload.confidence_rate
      ),
    provider: "mathpix",
  };
}

export async function recognizeFormulaImages({
  inputs,
  config = getDefaultConfig(),
}: {
  inputs: FormulaOcrInput[];
  config?: FormulaOcrConfig;
}): Promise<FormulaOcrResult[]> {
  if (inputs.length === 0) {
    return [];
  }

  const provider =
    selectFormulaOcrProvider(
      config
    );

  if (provider === "none") {
    return [];
  }

  if (
    provider ===
    "pp-formulanet"
  ) {
    return recognizeWithPpFormulaNet({
      inputs,
      endpoint:
        config.ppFormulaOcrUrl?.trim() ??
        "",
    });
  }

  const appId =
    config.mathpixAppId?.trim() ??
    "";
  const appKey =
    config.mathpixAppKey?.trim() ??
    "";
  const endpoint =
    config.mathpixEndpoint?.trim() ||
    "https://api.mathpix.com/v3/text";
  const results:
    FormulaOcrResult[] = [];

  for (const input of inputs) {
    const result =
      await recognizeMathpixImage({
        input,
        appId,
        appKey,
        endpoint,
      });

    if (result) {
      results.push(result);
    }
  }

  return results;
}
