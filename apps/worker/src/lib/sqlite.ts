export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes("unique constraint failed");
}
