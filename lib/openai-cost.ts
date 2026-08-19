export type OpenAIPricing = {
  input: number;
  cachedInput: number;
  cacheWrite?: number;
  output: number;
  longContext?: {
    thresholdInputTokens: number;
    inputMultiplier: number;
    outputMultiplier: number;
  };
};

export const OPENAI_PRICING: Record<string, OpenAIPricing> = {
  "gpt-5-mini": {
    input: 0.25,
    cachedInput: 0.025,
    output: 2.0,
  },

  "gpt-5.6-terra": {
    input: 2.0,
    cachedInput: 0.2,
    cacheWrite: 2.5,
    output: 12.0,
    longContext: {
      thresholdInputTokens: 272_000,
      inputMultiplier: 2,
      outputMultiplier: 1.5,
    },
  },

  "gpt-5.6-luna": {
    input: 0.2,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    longContext: {
      thresholdInputTokens: 272_000,
      inputMultiplier: 2,
      outputMultiplier: 1.5,
    },
  },
};

export function calculateOpenAICost({
  model,
  inputTokens,
  cachedInputTokens,
  cacheWriteTokens = 0,
  outputTokens,
}: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens?: number;
  outputTokens: number;
}) {
  const pricing = OPENAI_PRICING[model];

  if (!pricing) {
    throw new Error(
      `No existe configuración de precios para el modelo "${model}".`
    );
  }

  if (cacheWriteTokens > 0 && pricing.cacheWrite === undefined) {
    throw new Error(
      `No existe precio de cache write para el modelo "${model}".`
    );
  }

  const ordinaryInputTokens = Math.max(
    0,
    inputTokens - cachedInputTokens - cacheWriteTokens
  );

  const isLongContext =
    pricing.longContext !== undefined &&
    inputTokens > pricing.longContext.thresholdInputTokens;

  const inputMultiplier =
    isLongContext && pricing.longContext
      ? pricing.longContext.inputMultiplier
      : 1;

  const outputMultiplier =
    isLongContext && pricing.longContext
      ? pricing.longContext.outputMultiplier
      : 1;

  const appliedPricing = {
    input: pricing.input * inputMultiplier,
    cachedInput: pricing.cachedInput * inputMultiplier,
    cacheWrite:
      pricing.cacheWrite !== undefined
        ? pricing.cacheWrite * inputMultiplier
        : 0,
    output: pricing.output * outputMultiplier,
  };

  const ordinaryInputCost =
    (ordinaryInputTokens / 1_000_000) *
    appliedPricing.input;

  const cachedInputCost =
    (cachedInputTokens / 1_000_000) *
    appliedPricing.cachedInput;

  const cacheWriteCost =
    (cacheWriteTokens / 1_000_000) *
    appliedPricing.cacheWrite;

  const outputCost =
    (outputTokens / 1_000_000) *
    appliedPricing.output;

  const totalCost =
    ordinaryInputCost +
    cachedInputCost +
    cacheWriteCost +
    outputCost;

  return {
    totalCost,
    ordinaryInputCost,
    cachedInputCost,
    cacheWriteCost,
    outputCost,
    isLongContext,
    appliedPricing,
  };
}
