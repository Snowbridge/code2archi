import type { BuildSystem } from "../code-inventory/entities/application-module.js";
import type { ApplicationModuleRecord } from "../code-inventory/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../code-inventory/entities/application-module-dependency.js";
import type { DiscoveryEntityRecord } from "../code-inventory/entities/entity-types.js";
import type { CodeInventorySnapshot } from "../code-inventory/run-entity-store.js";
import {
  buildModulesByCoordinates,
  buildModulesByRepositoryAndCoordinates,
  resolveModuleForDependency,
} from "./application-module-components.js";
import { isEligibleApplicationModule } from "./module-version-catalog.js";

const BUILD_TIME_BUILD_SYSTEMS = new Set<BuildSystem>(["maven", "gradle"]);

export type BuildTimeDependencyAdjacency = ReadonlyMap<string, readonly string[]>;

export interface CanonicalCycle {
  readonly canonicalIds: readonly string[];
  readonly canonicalCycleKey: string;
}

function isBuildTimeGraphModule(
  module: ApplicationModuleRecord | undefined,
): module is ApplicationModuleRecord {
  if (module === undefined) {
    return false;
  }
  if (!isEligibleApplicationModule(module as unknown as DiscoveryEntityRecord)) {
    return false;
  }
  return BUILD_TIME_BUILD_SYSTEMS.has(module.buildSystem);
}

export function buildBuildTimeDependencyAdjacency(
  discovery: CodeInventorySnapshot,
): BuildTimeDependencyAdjacency {
  const allModules = [...discovery.listEntities("ApplicationModule")].map(
    (record) => record as unknown as ApplicationModuleRecord,
  );
  const modulesById = new Map<string, ApplicationModuleRecord>();
  for (const module of allModules) {
    if (isBuildTimeGraphModule(module)) {
      modulesById.set(module.id, module);
    }
  }

  const coordinateIndex = buildModulesByRepositoryAndCoordinates(allModules);
  const modulesByCoordinate = buildModulesByCoordinates(allModules);
  const edgeSets = new Map<string, Set<string>>();

  const dependencies = [...discovery.listEntities("ApplicationModuleDependency")]
    .map((record) => record as unknown as ApplicationModuleDependencyRecord)
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const dependency of dependencies) {
    const consumer = modulesById.get(dependency.parentId);
    if (consumer === undefined) {
      continue;
    }

    const targetModule = resolveModuleForDependency(
      coordinateIndex,
      modulesByCoordinate,
      consumer,
      dependency.groupId,
      dependency.artifactId,
    );
    if (!isBuildTimeGraphModule(targetModule)) {
      continue;
    }

    let targets = edgeSets.get(consumer.id);
    if (targets === undefined) {
      targets = new Set<string>();
      edgeSets.set(consumer.id, targets);
    }
    targets.add(targetModule.id);
  }

  const adjacency = new Map<string, readonly string[]>();
  for (const [source, targets] of edgeSets) {
    adjacency.set(source, [...targets].sort((left, right) => left.localeCompare(right)));
  }

  return adjacency;
}

function normalizeCycleWithClosingVertex(path: readonly string[]): readonly string[] {
  if (path.length < 2) {
    return path;
  }
  const first = path[0];
  const last = path[path.length - 1];
  if (first === last) {
    return path;
  }
  return [...path, first];
}

export function enumerateElementaryCycles(
  adjacency: BuildTimeDependencyAdjacency,
): readonly (readonly string[])[] {
  const nodes = [...adjacency.keys()].sort((left, right) => left.localeCompare(right));
  if (nodes.length === 0) {
    return [];
  }

  const circuits: string[][] = [];

  for (let startIndex = 0; startIndex < nodes.length; startIndex++) {
    const startNode = nodes[startIndex];
    const allowedNodes = new Set(nodes.slice(startIndex));
    const subgraph = new Map<string, string[]>();

    for (const node of allowedNodes) {
      const neighbors = (adjacency.get(node) ?? []).filter((neighbor) =>
        allowedNodes.has(neighbor),
      );
      if (neighbors.length > 0) {
        subgraph.set(node, neighbors);
      }
    }

    if (!subgraph.has(startNode)) {
      continue;
    }

    findCircuitsFrom(startNode, subgraph, circuits);
  }

  const normalized = circuits
    .map((circuit) => normalizeCycleWithClosingVertex(circuit))
    .filter((circuit) => circuit.length >= 2);

  const uniqueKeys = new Set<string>();
  const unique: string[][] = [];
  for (const circuit of normalized) {
    const key = circuit.join("\u0000");
    if (uniqueKeys.has(key)) {
      continue;
    }
    uniqueKeys.add(key);
    unique.push([...circuit]);
  }

  return unique;
}

function findCircuitsFrom(
  startNode: string,
  subgraph: ReadonlyMap<string, readonly string[]>,
  circuits: string[][],
): void {
  const blocked = new Set<string>();
  const blockedMap = new Map<string, string[]>();
  const stack: string[] = [];

  const unblock = (node: string): void => {
    blocked.delete(node);
    const blockedList = blockedMap.get(node);
    if (blockedList === undefined) {
      return;
    }
    while (blockedList.length > 0) {
      const successor = blockedList.pop();
      if (successor !== undefined && blocked.has(successor)) {
        unblock(successor);
      }
    }
    blockedMap.set(node, []);
  };

  const circuit = (node: string): boolean => {
    let closed = false;
    stack.push(node);
    blocked.add(node);

    for (const successor of subgraph.get(node) ?? []) {
      if (successor === startNode) {
        circuits.push([...stack]);
        closed = true;
      } else if (!blocked.has(successor)) {
        if (circuit(successor)) {
          closed = true;
        }
      }
    }

    if (closed) {
      unblock(node);
    } else {
      for (const successor of subgraph.get(node) ?? []) {
        let list = blockedMap.get(successor);
        if (list === undefined) {
          list = [];
          blockedMap.set(successor, list);
        }
        if (!list.includes(node)) {
          list.push(node);
        }
      }
    }

    stack.pop();
    return closed;
  };

  circuit(startNode);
}

function lexCompareStringArrays(left: readonly string[], right: readonly string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const comparison = left[index].localeCompare(right[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

export function canonicalizeCycle(ids: readonly string[]): CanonicalCycle {
  const shifts: string[][] = [];
  for (let offset = 0; offset < ids.length; offset++) {
    shifts.push([...ids.slice(offset), ...ids.slice(0, offset)]);
  }

  shifts.sort(lexCompareStringArrays);
  const canonicalIds = shifts[0];
  return {
    canonicalIds,
    canonicalCycleKey: canonicalIds.join(":"),
  };
}

export function dedupeAndSortCanonicalCycles(
  cycles: readonly (readonly string[])[],
): readonly CanonicalCycle[] {
  const byKey = new Map<string, CanonicalCycle>();
  for (const cycle of cycles) {
    const canonical = canonicalizeCycle(cycle);
    if (!byKey.has(canonical.canonicalCycleKey)) {
      byKey.set(canonical.canonicalCycleKey, canonical);
    }
  }

  return [...byKey.values()].sort((left, right) =>
    left.canonicalCycleKey.localeCompare(right.canonicalCycleKey),
  );
}

export function participantModuleIdsFromCanonicalCycle(
  canonicalIds: readonly string[],
): ReadonlySet<string> {
  const participants = new Set<string>();
  for (const id of canonicalIds) {
    participants.add(id);
  }
  return participants;
}

export function hasEdge(
  adjacency: BuildTimeDependencyAdjacency,
  sourceId: string,
  targetId: string,
): boolean {
  return (adjacency.get(sourceId) ?? []).includes(targetId);
}
