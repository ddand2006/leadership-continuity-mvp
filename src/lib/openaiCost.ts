const MODEL_PRICING = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  "gpt-4o": {
    inputPerMillion: 5,
    outputPerMillion: 15,
  },
} as const;

function getModelPricing(model: string) {
  if (model in MODEL_PRICING) {
    return MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  }

  const matchedEntry = Object.entries(MODEL_PRICING).find(([modelPrefix]) =>
    model.startsWith(modelPrefix),
  );

  return matchedEntry?.[1];
}

export function estimateOpenAICost({
  model,
  promptTokens,
  completionTokens,
}: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const pricing = getModelPricing(model);

  if (!pricing) {
    return 0;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(6));
}
