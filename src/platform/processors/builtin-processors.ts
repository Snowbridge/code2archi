import { CodeRepositoriesWithModulesProcessor } from "../../processors/generate.elements/code-repositories-with-modules-processor.js";
import { GradleModulesAndDependenciesProcessor } from "../../processors/scan.source/gradle-modules-and-dependencies-processor.js";
import { MavenModulesAndDependenciesProcessor } from "../../processors/scan.source/maven-modules-and-dependencies-processor.js";
import { NpmModulesAndDependenciesProcessor } from "../../processors/scan.source/npm-modules-and-dependencies-processor.js";
import { GitReposProcessor } from "../../processors/scan.scope/git-repos-processor.js";
import { UnversionedFoldersProcessor } from "../../processors/scan.scope/unversioned-folders-processor.js";
import { processorRegistry } from "./processor-registry.js";

processorRegistry.register(new GitReposProcessor());
processorRegistry.register(new UnversionedFoldersProcessor());
processorRegistry.register(new MavenModulesAndDependenciesProcessor());
processorRegistry.register(new GradleModulesAndDependenciesProcessor());
processorRegistry.register(new NpmModulesAndDependenciesProcessor());
processorRegistry.register(new CodeRepositoriesWithModulesProcessor());
