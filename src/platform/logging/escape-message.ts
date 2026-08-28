/** Escape tab, newline and backslash for TSV message field. */
export function escapeMessage(message: string): string {
  return message
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n");
}
