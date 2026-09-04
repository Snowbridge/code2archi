const UNQUOTED_CLI_ARG = /^[\w@+%.,:=/-]+$/;

export function shellQuoteCliArg(arg: string): string {
  if (UNQUOTED_CLI_ARG.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function formatCliCommandLine(argv: readonly string[] = process.argv): string {
  const userArgs = argv.slice(2);
  if (userArgs.length === 0) {
    return "code2archi";
  }

  return ["code2archi", ...userArgs].map(shellQuoteCliArg).join(" ");
}
