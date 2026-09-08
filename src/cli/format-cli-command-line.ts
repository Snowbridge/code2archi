const UNQUOTED_CLI_ARG = /^[\w@+%.,:=/-]+$/;

export function shellQuoteCliArg(arg: string): string {
  if (UNQUOTED_CLI_ARG.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function formatUserCliCommandLine(userArgs: readonly string[]): string {
  if (userArgs.length === 0) {
    return "code2archi";
  }

  return ["code2archi", ...userArgs].map(shellQuoteCliArg).join(" ");
}

export function formatCliCommandLine(argv: readonly string[] = process.argv): string {
  return formatUserCliCommandLine(argv.slice(2));
}
