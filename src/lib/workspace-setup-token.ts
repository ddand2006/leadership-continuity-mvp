import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminEnv } from "./env";

function signValue(value: string) {
  return createHmac("sha256", getSupabaseAdminEnv().SUPABASE_SECRET_KEY)
    .update(value)
    .digest("hex");
}

export function createWorkspaceSetupToken(options: {
  userId: string;
  email: string;
}) {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const payload = `${options.userId}:${options.email}:${expiresAt}`;
  const signature = signValue(payload);
  return `${expiresAt}.${signature}`;
}

export function verifyWorkspaceSetupToken(options: {
  token: string;
  userId: string;
  email: string;
}) {
  const [expiresAtRaw, signature] = options.token.split(".");

  if (!expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = signValue(
    `${options.userId}:${options.email}:${expiresAt}`,
  );

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}
