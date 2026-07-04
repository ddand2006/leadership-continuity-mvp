type PostgrestLikeError = {
  code?: string | null;
  details?: string | null;
  message?: string | null;
};

export function isMissingOrganizationIndustryColumnError(
  error: PostgrestLikeError | null | undefined,
) {
  if (!error) {
    return false;
  }

  const combinedMessage = `${error.message ?? ""} ${error.details ?? ""}`;

  return (
    /organizations/i.test(combinedMessage) &&
    /industry/i.test(combinedMessage) &&
    /(does not exist|schema cache|could not find)/i.test(combinedMessage)
  );
}
