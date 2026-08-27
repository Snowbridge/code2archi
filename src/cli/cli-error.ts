import { ExitCode } from "./exit-codes.js";

export class CliError extends Error {
  readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = ExitCode.ARGV) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}
