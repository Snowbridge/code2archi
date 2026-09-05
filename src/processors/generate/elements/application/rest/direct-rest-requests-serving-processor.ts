import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ProcessesRestRequestsProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ServingRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import {
  directRestServingLogicalId,
  directRestServingRelationshipId,
  directRestServingSourceId,
  directRestServingTargetId,
  selectBestDirectRestServingMatches,
  type DirectRestServingMatchLike,
} from "../../../../../generate/direct-rest-serving.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import type { RestClientToControllerLinkRecord } from "../../../../../discovery-model/links/rest-client-to-controller-link.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:direct-rest-requests-serving";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [ProcessesRestRequestsProfile.create()];

export class DirectRestRequestsServingProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "direct-rest-requests-serving",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestClientToControllerLink links to ServingRelationships between application module components.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const profiles = REQUIRED_PROFILES.filter(
      (profile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const matches = input.discovery
      .listLinks("RestClientToControllerLink")
      .map((record) => record as unknown as RestClientToControllerLinkRecord)
      .map(
        (record): DirectRestServingMatchLike => ({
          id: record.id,
          sourceApplicationModuleId: record.sourceApplicationModuleId,
          targetApplicationModuleId: record.targetApplicationModuleId,
          matchMethod: record.matchMethod,
          basis: record.basis,
          confidence: record.confidence,
        }),
      );

    const winners = selectBestDirectRestServingMatches(matches);
    const relations: ArchiRelationshipCreateIntent[] = [];
    const servingProfile = ProcessesRestRequestsProfile.create();

    for (const match of winners) {
      const sourceId = directRestServingSourceId(match.sourceApplicationModuleId);
      const targetId = directRestServingTargetId(match.targetApplicationModuleId);
      const relationId = directRestServingRelationshipId(sourceId, targetId);
      if (input.archi.getRelationship(relationId) !== undefined) {
        continue;
      }

      relations.push(
        (() => {
          let builder = ServingRelationship.withId(relationId)
            .source(sourceId)
            .target(targetId)
            .profiles(servingProfile.id);

          for (const property of standardGenerateElementProperties({
            logicalId: directRestServingLogicalId(
              match.sourceApplicationModuleId,
              match.targetApplicationModuleId,
            ),
            generatorCoordinate: GENERATOR_COORDINATE,
            slot: "direct-rest-requests-serving",
            basis: match.basis,
            confidence: match.confidence,
          })) {
            builder = builder.property(property.key, property.value);
          }

          return builder.build().toCreateIntent();
        })(),
      );
    }

    return {
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }
}
