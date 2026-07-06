import { z } from "zod";

const urlSchema = z.string().url();
const nonEmptyString = z.string().min(1);

function resolveSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function resolveSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && resolveSupabasePublishableKey(),
  );
}

export function getClientEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: urlSchema.parse(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmptyString.parse(
      resolveSupabasePublishableKey(),
    ),
  };
}

export function getAppUrl() {
  return urlSchema.parse(process.env.APP_URL);
}

export function getSupabaseAdminEnv() {
  return {
    ...getClientEnv(),
    SUPABASE_SECRET_KEY: nonEmptyString.parse(resolveSupabaseSecretKey()),
  };
}

export function getOpenAIEnv() {
  const defaultModel = process.env.OPENAI_MODEL ?? "gpt-5.5";

  return {
    OPENAI_MODEL: defaultModel,
    OPENAI_FAST_MODEL: process.env.OPENAI_FAST_MODEL ?? defaultModel,
    OPENAI_API_KEY: nonEmptyString.parse(process.env.OPENAI_API_KEY),
  };
}

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getServerEnv() {
  return {
    ...getSupabaseAdminEnv(),
    ...getOpenAIEnv(),
    APP_URL: getAppUrl(),
  };
}
