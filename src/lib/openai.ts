import OpenAI from "openai";
import { getServerEnv } from "./env";

export function createOpenAIClient() {
  const env = getServerEnv();

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}
