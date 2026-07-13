import { getAppUrl } from "@/lib/env";
import {
  getDefaultRoleSurveyIntroMessage,
  type RoleSurveyRecord,
} from "@/lib/role-competency-surveys";
import { sanitizeAppText } from "@/lib/text-sanitizer";

type BuildRoleSurveyInviteEmailInput = {
  recipientName: string;
  survey: Pick<RoleSurveyRecord, "title" | "intro_message">;
  roleTitle: string;
  surveyToken: string;
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphize(value: string) {
  return sanitizeAppText(value)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function buildRoleSurveyLink(token: string) {
  return `${trimTrailingSlash(getAppUrl())}/role-surveys/${token}`;
}

export function buildRoleSurveyInviteEmail(
  input: BuildRoleSurveyInviteEmailInput,
) {
  const surveyLink = buildRoleSurveyLink(input.surveyToken);
  const greetingName = sanitizeAppText(input.recipientName);
  const greeting = greetingName ? `Hi ${greetingName},` : "Hello,";
  const introMessage =
    sanitizeAppText(input.survey.intro_message) ||
    getDefaultRoleSurveyIntroMessage(input.roleTitle);
  const subject = sanitizeAppText(input.survey.title) || "Role competency survey";
  const text = [
    greeting,
    "",
    introMessage,
    "",
    `Open the survey: ${surveyLink}`,
    "",
    "Thank you for sharing your perspective.",
  ].join("\n");

  const introParagraphs = paragraphize(introMessage);
  const html = [
    "<div style=\"background:#f4f7f8;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;\">",
    "<div style=\"max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3e8;border-radius:24px;padding:32px;\">",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;">${escapeHtml(greeting)}</p>`,
    ...introParagraphs.map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#334155;">${escapeHtml(paragraph)}</p>`,
    ),
    `<p style="margin:24px 0;"><a href="${escapeHtml(surveyLink)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:999px;font-weight:600;">Open survey</a></p>`,
    `<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">If the button does not open, use this link:</p>`,
    `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;word-break:break-word;"><a href="${escapeHtml(surveyLink)}" style="color:#0f766e;">${escapeHtml(surveyLink)}</a></p>`,
    "<p style=\"margin:0;font-size:14px;line-height:1.7;color:#475569;\">Thank you for sharing your perspective.</p>",
    "</div>",
    "</div>",
  ].join("");

  return {
    subject,
    text,
    html,
    surveyLink,
  };
}
