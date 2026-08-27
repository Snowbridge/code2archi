export const PROCESSOR_GROUPS = [
  "scan-scope",
  "scan-tech",
  "scan-source",
  "generate-element",
  "generate-relation",
  "generate-view",
] as const;

export type ProcessorGroupId = (typeof PROCESSOR_GROUPS)[number];

export interface ProcessorGroupDef {
  groupId: ProcessorGroupId;
  withoutArgvKey: keyof GlobalArgv;
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
  withoutScanScope: string[];
  withoutScanTech: string[];
  withoutScanSource: string[];
  withoutGenerateElement: string[];
  withoutGenerateRelation: string[];
  withoutGenerateView: string[];
  withOnlyScanScope: string[];
  withOnlyScanTech: string[];
  withOnlyScanSource: string[];
  withOnlyGenerateElement: string[];
  withOnlyGenerateRelation: string[];
  withOnlyGenerateView: string[];
}

export type LogLevel = "INFO" | "DEBUG";

export const PROCESSOR_GROUP_DEFS: ProcessorGroupDef[] = [
  {
    groupId: "scan-scope",
    withoutArgvKey: "withoutScanScope",
    withOnlyArgvKey: "withOnlyScanScope",
  },
  {
    groupId: "scan-tech",
    withoutArgvKey: "withoutScanTech",
    withOnlyArgvKey: "withOnlyScanTech",
  },
  {
    groupId: "scan-source",
    withoutArgvKey: "withoutScanSource",
    withOnlyArgvKey: "withOnlyScanSource",
  },
  {
    groupId: "generate-element",
    withoutArgvKey: "withoutGenerateElement",
    withOnlyArgvKey: "withOnlyGenerateElement",
  },
  {
    groupId: "generate-relation",
    withoutArgvKey: "withoutGenerateRelation",
    withOnlyArgvKey: "withOnlyGenerateRelation",
  },
  {
    groupId: "generate-view",
    withoutArgvKey: "withoutGenerateView",
    withOnlyArgvKey: "withOnlyGenerateView",
  },
];

const PROCESSOR_GROUP_ID_SET = new Set<string>(PROCESSOR_GROUPS);

export function isProcessorGroupId(value: string): value is ProcessorGroupId {
  return PROCESSOR_GROUP_ID_SET.has(value);
}
