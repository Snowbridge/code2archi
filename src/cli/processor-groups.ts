export const BUILTIN_PROCESSOR_GROUPS = [
  "scan.scope",
  "scan.source",
  "scan.link",
  "generate.elements",
  "generate.views",
] as const;

export type BuiltInProcessorGroupId = (typeof BUILTIN_PROCESSOR_GROUPS)[number];

export const SCAN_PROCESSOR_GROUPS = [
  "scan.scope",
  "scan.source",
  "scan.link",
] as const satisfies readonly BuiltInProcessorGroupId[];

export type ScanProcessorGroupId = (typeof SCAN_PROCESSOR_GROUPS)[number];

export const SCAN_SCOPE_GROUP_ID: ScanProcessorGroupId = "scan.scope";

export const SCAN_SOURCE_GROUP_ID: ScanProcessorGroupId = "scan.source";

export const SCAN_LINK_GROUP_ID: ScanProcessorGroupId = "scan.link";

export const GENERATE_PROCESSOR_GROUPS = [
  "generate.elements",
  "generate.views",
] as const satisfies readonly BuiltInProcessorGroupId[];

export type GenerateProcessorGroupId = (typeof GENERATE_PROCESSOR_GROUPS)[number];

export const GENERATE_ELEMENTS_GROUP_ID: GenerateProcessorGroupId = "generate.elements";

export const GENERATE_VIEWS_GROUP_ID: GenerateProcessorGroupId = "generate.views";

export type LogLevel = "INFO" | "DEBUG";

export interface GlobalArgv {
  logLevel: LogLevel;
  verbose: boolean;
  profile: boolean;
  threads: number;
  sync: boolean;
  continueOnError: boolean;
  with: string[];
  without: string[];
  withOnly: string[];
}

const BUILTIN_GROUP_ID_SET = new Set<string>(BUILTIN_PROCESSOR_GROUPS);

export function isBuiltInProcessorGroupId(value: string): value is BuiltInProcessorGroupId {
  return BUILTIN_GROUP_ID_SET.has(value);
}
