export interface ArchiDiagramBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ArchiDiagramConnection {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly archimateRelationship: string;
}

export interface ArchiDiagramObject {
  readonly id: string;
  readonly archimateElement: string;
  readonly bounds: ArchiDiagramBounds;
  readonly textPosition: "1";
  readonly sourceConnections: readonly ArchiDiagramConnection[];
  readonly targetConnectionIds: readonly string[];
}

export interface ArchimateDiagramModelFields {
  readonly viewpoint: string;
  readonly diagramObjects: readonly ArchiDiagramObject[];
}
