import { writeFileSync } from "node:fs";
import path from "node:path";
import { archimateXsiType } from "./concept-types.js";
import type { ArchiModelStore } from "./archi-model-store.js";
import type { ArchiElementCreateIntent } from "./elements/archi-element.js";
import type { ArchiFolder } from "./folders/archi-folder.js";
import type { ArchiProfileCreateIntent } from "./profiles/profile.js";
import { getLogger } from "../platform/logging/index.js";

export interface ArchiModelWriteInput {
  readonly outputFile: string;
  readonly store: ArchiModelStore;
}

interface FolderNode {
  readonly folder: ArchiFolder;
  children: FolderNode[];
  elements: ArchiElementCreateIntent[];
}

export class ArchiModelWriter {
  write(input: ArchiModelWriteInput): void {
    const logger = getLogger("generate.writer");
    const absoluteOutput = path.resolve(input.outputFile);
    logger.info("writing archimate-model", { path: absoluteOutput });

    const xml = this.serialize(input.store);
    writeFileSync(absoluteOutput, xml, "utf8");

    logger.info("archimate-model written", { path: absoluteOutput });
  }

  private serialize(store: ArchiModelStore): string {
    const folders = store.listFolders();
    const elements = store.listElements();
    const profiles = store.listProfiles();
    const folderNodes = this.buildFolderTree(folders, elements);
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="${escapeXml(
        store.modelName,
      )}" id="${escapeXml(store.modelId)}" version="5.0.0">`,
    ];

    for (const node of folderNodes) {
      lines.push(...this.serializeFolderNode(node, 1));
    }

    for (const profile of profiles) {
      lines.push(this.serializeProfile(profile, 1));
    }

    lines.push("</archimate:model>", "");
    return lines.join("\n");
  }

  private buildFolderTree(
    folders: readonly ArchiFolder[],
    elements: readonly ArchiElementCreateIntent[],
  ): FolderNode[] {
    const nodes = new Map<string, FolderNode>(
      folders.map((folder) => [
        folder.id,
        { folder, children: [], elements: [] },
      ]),
    );

    for (const element of elements) {
      const node = nodes.get(element.folderId);
      if (node) {
        node.elements.push(element);
      }
    }

    const roots: FolderNode[] = [];
    for (const node of nodes.values()) {
      const parentId = node.folder.parentFolderId;
      if (!parentId) {
        roots.push(node);
        continue;
      }

      const parent = nodes.get(parentId);
      if (parent) {
        parent.children.push(node);
      }
    }

    const sortNodes = (left: FolderNode, right: FolderNode): number =>
      left.folder.name.localeCompare(right.folder.name);

    for (const node of nodes.values()) {
      node.children.sort(sortNodes);
      node.elements.sort((a, b) => a.name.localeCompare(b.name));
    }

    roots.sort(sortNodes);
    return roots;
  }

  private serializeFolderNode(node: FolderNode, indent: number): string[] {
    const pad = "  ".repeat(indent);
    const typeAttr = node.folder.xmlType ? ` type="${escapeXml(node.folder.xmlType)}"` : "";
    const lines = [
      `${pad}<folder name="${escapeXml(node.folder.name)}" id="${escapeXml(node.folder.id)}"${typeAttr}>`,
    ];

    for (const child of node.children) {
      lines.push(...this.serializeFolderNode(child, indent + 1));
    }

    for (const element of node.elements) {
      lines.push(this.serializeElement(element, indent + 1));
    }

    lines.push(`${pad}</folder>`);
    return lines;
  }

  private serializeElement(element: ArchiElementCreateIntent, indent: number): string {
    const pad = "  ".repeat(indent);
    const profilesAttr =
      element.profileIds && element.profileIds.length > 0
        ? ` profiles="${escapeXml(element.profileIds.join(" "))}"`
        : "";
    const lines = [
      `${pad}<element xsi:type="${escapeXml(archimateXsiType(element.conceptType))}" name="${escapeXml(
        element.name,
      )}" id="${escapeXml(element.id)}"${profilesAttr}>`,
    ];

    if (element.documentation) {
      lines.push(`${pad}  <documentation>${escapeXml(element.documentation)}</documentation>`);
    }

    for (const property of element.properties ?? []) {
      lines.push(
        `${pad}  <property key="${escapeXml(property.key)}" value="${escapeXml(property.value)}"/>`,
      );
    }

    lines.push(`${pad}</element>`);
    return lines.join("\n");
  }

  private serializeProfile(profile: ArchiProfileCreateIntent, indent: number): string {
    const pad = "  ".repeat(indent);
    return `${pad}<profile name="${escapeXml(profile.name)}" id="${escapeXml(
      profile.id,
    )}" conceptType="${escapeXml(String(profile.conceptType))}"/>`;
  }
}

function escapeXml(value: string): string {
  return value
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
