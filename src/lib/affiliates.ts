import { z } from "zod";

export const affiliateSlug = z.string().min(2).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Permanent page address: use lowercase letters, numbers and hyphens, such as miller-enterprises (no spaces or full URL)");
export const affiliateBranding = z.object({
  displayName: z.string().trim().min(2).max(120),
  headline: z.string().trim().min(5).max(180),
  description: z.string().trim().min(20).max(2000),
  contactEmail: z.string().trim().email().max(320),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.union([z.literal(""), z.string().url().refine(value => new URL(value).protocol === "https:", "Use an HTTPS logo URL")]),
});
export const affiliateInput = z.object({
  id: z.string().uuid().optional(), slug: affiliateSlug,
  name: z.string().trim().min(2).max(160), branding: affiliateBranding,
  initialPercent: z.number().min(0).max(100).multipleOf(0.01),
  renewalPercent: z.number().min(0).max(100).multipleOf(0.01),
  renewalYears: z.number().int().min(1).max(100).nullable(),
  action: z.enum(["save", "publish", "unpublish"]),
  approved: z.boolean().default(false),
}).refine(value => value.action !== "publish" || value.approved, "Confirm the affiliate approved this page before publishing");
export type AffiliateBranding = z.infer<typeof affiliateBranding>;
