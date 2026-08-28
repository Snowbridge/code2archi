export const PROCESSOR_GROUPS = [
  "scan-scope",
  "scan-tech",
  "scan-app",
  "generate-element",
  "generate-relation",
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
  withGenerateElement: string[];
  withGenerateRelation: string[];
  withGenerateView: string[];
  withoutScanScope: string[];
  withoutScanTech: string[];
  withoutScanApp: string[];
  withoutGenerateElement: string[];
  withoutGenerateRelation: string[];
  withoutGenerateView: string[];
  withOnlyScanScope: string[];
  withOnlyScanTech: string[];
  withOnlyScanApp: string[];
  withOnlyGenerateElement: string[];
  withOnlyGenerateRelation: string[];
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
    groupId: "generate-element",
    withoutArgvKey: "withoutGenerateElement",
    withArgvKey: "withGenerateElement",
    withOnlyArgvKey: "withOnlyGenerateElement",
  },
  {
    groupId: "generate-relation",
    withoutArgvKey: "withoutGenerateRelation",
    withArgvKey: "withGenerateRelation",
    withOnlyArgvKey: "withOnlyGenerateRelation",
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
