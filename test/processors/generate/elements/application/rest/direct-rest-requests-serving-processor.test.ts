import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationComponent } from "../../../../../../src/archimate-model/elements/archi-element.js";
import {
  MavenModuleProfile,
  ProcessesRestRequestsProfile,
} from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { DirectRestRequestsServingMatch } from "../../../../../../src/discovery-model/links/direct-rest-requests-serving-match.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import {
  directRestServingLogicalId,
  directRestServingRelationshipId,
} from "../../../../../../src/generate/direct-rest-serving.js";
import { DirectRestRequestsServingProcessor } from "../../../../../../src/processors/generate/elements/application/rest/direct-rest-requests-serving-processor.js";
import { defaultGenerateProcessorOptions } from "../../../../../generate/generate-processor-test-options.js";

function moduleRecord(
  naturalKeys: ConstructorParameters<typeof ApplicationModule>[0],
): ReturnType<ApplicationModule["toCreateIntent"]> {
  return new ApplicationModule(naturalKeys).toCreateIntent();
}

function seedAppModuleComponent(store: ArchiModelStore, module: ReturnType<typeof moduleRecord>): string {
  const applicationFolderId = store.getPredefinedFolderId("application");
  const componentId = applicationComponentIdForModule(module.id);
  const profile = MavenModuleProfile.create();
  if (store.snapshot().findProfile(profile.name, profile.conceptType) === undefined) {
    store.registerProfile(profile);
  }
  if (store.snapshot().getElement(componentId) === undefined) {
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application", artifactId: "app-components-from-modules" },
      {
        elements: [
          ApplicationComponent.withId(componentId)
            .name(String(module.name))
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
  return componentId;
}

describe("DirectRestRequestsServingProcessor (generate)", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new DirectRestRequestsServingProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "direct-rest-requests-serving",
    });
  });

  it("creates one ServingRelationship per module pair using the best link", () => {
    const serverModule = moduleRecord({
      repositoryId: "repo-1",
      name: "server",
      groupId: "com.example",
      artifactId: "server",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "server",
    });
    const clientModule = moduleRecord({
      repositoryId: "repo-1",
      name: "client",
      groupId: "com.example",
      artifactId: "client",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "client",
    });

    const interfaceLink = new DirectRestRequestsServingMatch({
      restControllerId: "ctrl-1",
      restClientId: "client-1",
      sourceApplicationModuleId: serverModule.id,
      targetApplicationModuleId: clientModule.id,
      matchMethod: "INTERFACE",
      confidence: "confirmed",
      confidenceScore: 1,
      matchedValues: ["com.example.Api"],
    }).toCreateIntent();
    const dtoLink = new DirectRestRequestsServingMatch({
      restControllerId: "ctrl-1",
      restClientId: "client-1",
      sourceApplicationModuleId: serverModule.id,
      targetApplicationModuleId: clientModule.id,
      matchMethod: "DTO",
      confidence: "inferred",
      confidenceScore: 0.7,
      matchedValues: ["com.example.FooDto"],
    }).toCreateIntent();

    const discovery = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        ApplicationModule: [serverModule, clientModule],
      },
      linkArrays: {
        DirectRestRequestsServingMatch: [
          { ...interfaceLink, linkerExtractor: "scan.link.rest:direct-rest-requests-serving", linkerSchema: "0.0.0", linkedAt: "2026-01-01T00:00:00+00:00" },
          { ...dtoLink, linkerExtractor: "scan.link.rest:direct-rest-requests-serving", linkerSchema: "0.0.0", linkedAt: "2026-01-01T00:00:00+00:00" },
        ],
      },
    });

    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedAppModuleComponent(store, serverModule);
    seedAppModuleComponent(store, clientModule);

    const output = new DirectRestRequestsServingProcessor().process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations?.length, 1);
    const relation = output.relations?.[0];
    const sourceId = applicationComponentIdForModule(serverModule.id);
    const targetId = applicationComponentIdForModule(clientModule.id);
    assert.equal(relation?.sourceId, sourceId);
    assert.equal(relation?.targetId, targetId);
    assert.equal(
      relation?.id,
      directRestServingRelationshipId(sourceId, targetId),
    );
    assert.equal(
      relation?.properties.find((property) => property.key === "c2a:confidence")?.value,
      "confirmed",
    );
    assert.equal(
      relation?.properties.find((property) => property.key === "c2a:confidenceScore")?.value,
      "1",
    );
    assert.equal(
      relation?.properties.find((property) => property.key === "c2a:Id")?.value,
      directRestServingLogicalId(serverModule.id, clientModule.id),
    );
    assert.equal(output.profiles?.length, 1);
    assert.equal(output.profiles?.[0]?.name, ProcessesRestRequestsProfile.create().name);
  });

  it("skips Serving when app-module-component is missing", () => {
    const serverModule = moduleRecord({
      repositoryId: "repo-1",
      name: "server",
      groupId: "com.example",
      artifactId: "server",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "server",
    });
    const clientModule = moduleRecord({
      repositoryId: "repo-1",
      name: "client",
      groupId: "com.example",
      artifactId: "client",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "client",
    });
    const link = new DirectRestRequestsServingMatch({
      restControllerId: "ctrl-1",
      restClientId: "client-1",
      sourceApplicationModuleId: serverModule.id,
      targetApplicationModuleId: clientModule.id,
      matchMethod: "INTERFACE",
      confidence: "confirmed",
      confidenceScore: 1,
    }).toCreateIntent();

    const discovery = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        ApplicationModule: [serverModule, clientModule],
      },
      linkArrays: {
        DirectRestRequestsServingMatch: [
          {
            ...link,
            linkerExtractor: "scan.link.rest:direct-rest-requests-serving",
            linkerSchema: "0.0.0",
            linkedAt: "2026-01-01T00:00:00+00:00",
          },
        ],
      },
    });

    const output = new DirectRestRequestsServingProcessor().process({
      discovery,
      archi: new ArchiModelStore({ modelName: "test", modelId: "model-1" }).snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations?.length ?? 0, 0);
  });
});
