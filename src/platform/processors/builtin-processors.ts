import { GradleModulesAndDependenciesProcessor } from "../../processors/scan-app/gradle-modules-and-dependencies-processor.js";
import { MavenModulesAndDependenciesProcessor } from "../../processors/scan-app/maven-modules-and-dependencies-processor.js";
import { NpmModulesAndDependenciesProcessor } from "../../processors/scan-app/npm-modules-and-dependencies-processor.js";
import { GitReposProcessor } from "../../processors/scan-scope/git-repos-processor.js";
import { UnversionedFoldersProcessor } from "../../processors/scan-scope/unversioned-folders-processor.js";
import { processorRegistry } from "./processor-registry.js";

processorRegistry.register(new GitReposProcessor());
processorRegistry.register(new UnversionedFoldersProcessor());
processorRegistry.register(new MavenModulesAndDependenciesProcessor());
processorRegistry.register(new GradleModulesAndDependenciesProcessor());
processorRegistry.register(new NpmModulesAndDependenciesProcessor());
