import { getResendEnv } from "@/lib/env";

type ResendTag = {
  name: string;
  value: string;
};

type SendResendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  tags?: ResendTag[];
  idempotencyKey?: string;
};

type ResendSendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export class ResendSendError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function buildFromAddress() {
  const env = getResendEnv();

  if (!env.RESEND_FROM_NAME) {
    return env.RESEND_FROM_EMAIL;
  }

  return `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;
}

export async function sendResendEmail(input: SendResendEmailInput) {
  const env = getResendEnv();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? {
            "Idempotency-Key": input.idempotencyKey,
          }
        : {}),
    },
    body: JSON.stringify({
      from: buildFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    }),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as ResendSendEmailResponse;

  if (!response.ok) {
    throw new ResendSendError(
      payload.message || payload.name || "Resend could not send this email.",
      response.status,
    );
  }

  return payload;
}
