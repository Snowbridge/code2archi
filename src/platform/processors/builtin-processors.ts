import { GitReposProcessor } from "../../processors/scan-scope/git-repos-processor.js";
import { UnversionedFoldersProcessor } from "../../processors/scan-scope/unversioned-folders-processor.js";
import { processorRegistry } from "./processor-registry.js";

processorRegistry.register(new GitReposProcessor());
processorRegistry.register(new UnversionedFoldersProcessor());
