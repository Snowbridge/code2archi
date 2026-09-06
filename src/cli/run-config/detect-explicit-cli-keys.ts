import {
  positionalKeysForCommand,
  resolveCanonicalOptionKey,
  resolveCommandName,
} from "./cli-option-catalog.js";
import type { RunConfigCommandName } from "./run-config-types.js";

function isOptionToken(token: string): boolean {
  return token.startsWith("-");
}

export function detectExplicitCliKeys(argv: readonly string[]): Set<string> {
  const explicit = new Set<string>();
  const command = detectCommandName(argv);
  let index = 0;

  while (index < argv.length) {
    const token = argv[index]!;
    const canonical = resolveCanonicalOptionKey(token);

    if (canonical !== undefined) {
      explicit.add(canonical);
      if (token.startsWith("--") && !token.includes("=")) {
        const next = argv[index + 1];
        if (next !== undefined && !isOptionToken(next)) {
          index += 1;
        }
      }
      index += 1;
      continue;
    }

    if (command !== undefined && resolveCommandName(token) === command) {
      index += 1;
      let positionalIndex = 0;
      const positionalKeys = positionalKeysForCommand(command);

      while (index < argv.length) {
        const current = argv[index]!;
        if (isOptionToken(current)) {
          break;
        }

        if (positionalIndex < positionalKeys.length) {
          explicit.add(positionalKeys[positionalIndex]!);
          positionalIndex += 1;
        }

        index += 1;
      }
      continue;
    }

    index += 1;
  }

  return explicit;
}

export function detectCommandName(argv: readonly string[]): RunConfigCommandName | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (isOptionToken(token)) {
      if (token.startsWith("--") && !token.includes("=")) {
        const next = argv[index + 1];
        if (next !== undefined && !isOptionToken(next)) {
          index += 1;
        }
      }
      continue;
    }

    const command = resolveCommandName(token);
    if (command !== undefined) {
      return command;
    }
  }

  return undefined;
}

export function readConfigFlagValue(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--config") {
      const next = argv[index + 1];
      if (next === undefined || isOptionToken(next)) {
        throw new Error("Missing value for --config");
      }
      return next;
    }

    if (token.startsWith("--config=")) {
      return token.slice("--config=".length);
    }
  }

  return undefined;
}

export function shouldSkipRunConfigLoad(argv: readonly string[]): boolean {
  return argv.some((token) => token === "--help" || token === "-h" || token === "--version" || token === "-v");
}
