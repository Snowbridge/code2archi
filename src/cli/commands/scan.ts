import type { CommandModule } from "yargs";

export const scanCommand: CommandModule = {
  command: "scan",
  describe: "Scan source repositories and produce discovery-model",
  builder: (yargs) => yargs,
  handler: () => {
    // Skeleton: global options are parsed and validated; no runtime behavior yet.
  },
};
