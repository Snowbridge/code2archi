function formatContextValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Serialize context as space-separated key=value pairs appended to message. */
export function appendContext(
  message: string,
  context?: Record<string, unknown>,
): string {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }

  const pairs = Object.entries(context).map(
    ([key, value]) => `${key}=${formatContextValue(value)}`,
  );
  return `${message} ${pairs.join(" ")}`.trim();
}
