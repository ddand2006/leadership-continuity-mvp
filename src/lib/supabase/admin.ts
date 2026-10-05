import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { getSupabaseAdminEnv } from "../env";

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function createLegacyServiceRoleJwt(jwtSecret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: "authenticated",
      exp: issuedAt + 60 * 60 * 24 * 365,
      iat: issuedAt,
      iss: "supabase",
      role: "service_role",
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export function createSupabaseAdminClient() {
  const env = getSupabaseAdminEnv();
  const adminKey =
    env.SUPABASE_JWT_SECRET && env.SUPABASE_SECRET_KEY.split(".").length !== 3
      ? createLegacyServiceRoleJwt(env.SUPABASE_JWT_SECRET)
      : env.SUPABASE_SECRET_KEY;

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    adminKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
