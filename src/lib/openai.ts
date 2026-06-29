import OpenAI from "openai";
import { getOpenAIEnv } from "./env";

export function createOpenAIClient() {
  const env = getOpenAIEnv();

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}
