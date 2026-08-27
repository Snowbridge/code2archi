/** UTC compact timestamp for artifact directory/file names (YYYYMMDDTHHmmssZ). ISO 8601 without colons. */
export function formatRunTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[^\d|A-z]/ig,"");
}
