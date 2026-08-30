export const PROCESSOR_GROUPS = [
  "scan-scope",
  "scan-tech",
  "scan-app",
  "generate-biz",
  "generate-app",
  "generate-tech",
  "generate-rel",
  "generate-view",
] as const;

export type ProcessorGroupId = (typeof PROCESSOR_GROUPS)[number];

export interface ProcessorGroupDef {
  groupId: ProcessorGroupId;
  withoutArgvKey: keyof GlobalArgv;
  withArgvKey: keyof GlobalArgv;
  withOnlyArgvKey: keyof GlobalArgv;
}

export interface GlobalArgv {
  logLevel: LogLevel;
  verbose: boolean;
  profile: boolean;
  threads: number;
  sync: boolean;
  continueOnError: boolean;
  withNone: string[];
  withScanScope: string[];
  withScanTech: string[];
  withScanApp: string[];
  withGenerateBiz: string[];
  withGenerateApp: string[];
  withGenerateTech: string[];
  withGenerateRel: string[];
  withGenerateView: string[];
  withoutScanScope: string[];
  withoutScanTech: string[];
  withoutScanApp: string[];
  withoutGenerateBiz: string[];
  withoutGenerateApp: string[];
  withoutGenerateTech: string[];
  withoutGenerateRel: string[];
  withoutGenerateView: string[];
  withOnlyScanScope: string[];
  withOnlyScanTech: string[];
  withOnlyScanApp: string[];
  withOnlyGenerateBiz: string[];
  withOnlyGenerateApp: string[];
  withOnlyGenerateTech: string[];
  withOnlyGenerateRel: string[];
  withOnlyGenerateView: string[];
}

export type LogLevel = "INFO" | "DEBUG";

export const PROCESSOR_GROUP_DEFS: ProcessorGroupDef[] = [
  {
    groupId: "scan-scope",
    withoutArgvKey: "withoutScanScope",
    withArgvKey: "withScanScope",
    withOnlyArgvKey: "withOnlyScanScope",
  },
  {
    groupId: "scan-tech",
    withoutArgvKey: "withoutScanTech",
    withArgvKey: "withScanTech",
    withOnlyArgvKey: "withOnlyScanTech",
  },
  {
    groupId: "scan-app",
    withoutArgvKey: "withoutScanApp",
    withArgvKey: "withScanApp",
    withOnlyArgvKey: "withOnlyScanApp",
  },
  {
    groupId: "generate-biz",
    withoutArgvKey: "withoutGenerateBiz",
    withArgvKey: "withGenerateBiz",
    withOnlyArgvKey: "withOnlyGenerateBiz",
  },
  {
    groupId: "generate-app",
    withoutArgvKey: "withoutGenerateApp",
    withArgvKey: "withGenerateApp",
    withOnlyArgvKey: "withOnlyGenerateApp",
  },
  {
    groupId: "generate-tech",
    withoutArgvKey: "withoutGenerateTech",
    withArgvKey: "withGenerateTech",
    withOnlyArgvKey: "withOnlyGenerateTech",
  },
  {
    groupId: "generate-rel",
    withoutArgvKey: "withoutGenerateRel",
    withArgvKey: "withGenerateRel",
    withOnlyArgvKey: "withOnlyGenerateRel",
  },
  {
    groupId: "generate-view",
    withoutArgvKey: "withoutGenerateView",
    withArgvKey: "withGenerateView",
    withOnlyArgvKey: "withOnlyGenerateView",
  },
];

const PROCESSOR_GROUP_ID_SET = new Set<string>(PROCESSOR_GROUPS);

export function isProcessorGroupId(value: string): value is ProcessorGroupId {
  return PROCESSOR_GROUP_ID_SET.has(value);
}

export const SCAN_PROCESSOR_GROUPS = [
  "scan-scope",
  "scan-tech",
  "scan-app",
] as const satisfies readonly ProcessorGroupId[];

export type ScanProcessorGroupId = (typeof SCAN_PROCESSOR_GROUPS)[number];

export type ScanScopeGroupId = Extract<ScanProcessorGroupId, "scan-scope">;

export type ScanDiscoveryProcessorGroupId = Extract<
  ScanProcessorGroupId,
  "scan-tech" | "scan-app"
>;

export const SCAN_SCOPE_GROUP_ID: ScanScopeGroupId = "scan-scope";

export const GENERATE_PROCESSOR_GROUPS = [
  "generate-biz",
  "generate-app",
  "generate-tech",
  "generate-rel",
  "generate-view",
] as const satisfies readonly ProcessorGroupId[];

export type GenerateProcessorGroupId = (typeof GENERATE_PROCESSOR_GROUPS)[number];
