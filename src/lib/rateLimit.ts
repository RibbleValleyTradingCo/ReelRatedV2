export const RATE_LIMIT_MESSAGE = "You’re doing that too quickly. Please try again later.";

export const isRateLimitError = (error: unknown): error is { message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    ((error as { message: string }).message?.startsWith("RATE_LIMITED:"))
  );
};

export const getRateLimitMessage = (error?: unknown): string => {
  if (isRateLimitError(error)) {
    return RATE_LIMIT_MESSAGE;
  }
  return RATE_LIMIT_MESSAGE;
};
