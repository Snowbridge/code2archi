import { GitReposProcessor } from "../../processors/scan-scope/git-repos-processor.js";
import { processorRegistry } from "./processor-registry.js";

processorRegistry.register(new GitReposProcessor());
