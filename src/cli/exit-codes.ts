export const ExitCode = {
  SUCCESS: 0,
  RUNTIME: 1,
  ARGV: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
