/**
 * Oculus Bridge Service
 *
 * Transforms Windchill PLM data into XR-compatible spatial structures.
 * This service sits between the MCP agents and XR clients, converting
 * flat PLM data (parts, BOMs, changes, workflows) into 3D scene graphs
 * that can be rendered in Meta Quest headsets or WebXR browsers.
 */

import { logger } from '../config/logger.js';
import {
  Vec3,
  Quaternion,
  SpatialTransform,
  BoundingBox,
  SceneNode,
  SceneNodeType,
  SceneNodeMetadata,
  XRScene,
  XREnvironment,
  DataSourceBinding,
  SpatialBOMNode,
  SpatialAnnotation,
  SpatialChangeReview,
  SpatialChangeMarker,
  SpatialWorkflowDashboard,
  SpatialWorkflowItem,
  DashboardLayout,
  XRSessionState,
  XRHandoffPayload,
  DataMappingType,
} from '../types/oculus-types.js';

// ─── Geometry Helpers ────────────────────────────────────────────────

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function quaternionIdentity(): Quaternion {
  return { x: 0, y: 0, z: 0, w: 1 };
}

export function identityTransform(): SpatialTransform {
  return {
    position: vec3(),
    rotation: quaternionIdentity(),
    scale: vec3(1, 1, 1),
  };
}

export function transformAt(x: number, y: number, z: number): SpatialTransform {
  return {
    position: vec3(x, y, z),
    rotation: quaternionIdentity(),
    scale: vec3(1, 1, 1),
  };
}

// ─── Scene Node Factory ──────────────────────────────────────────────

let nodeCounter = 0;

export function createSceneNode(
  name: string,
  type: SceneNodeType,
  transform?: SpatialTransform,
  metadata?: Partial<SceneNodeMetadata>
): SceneNode {
  nodeCounter++;
  return {
    id: `node_${Date.now()}_${nodeCounter}`,
    name,
    type,
    transform: transform || identityTransform(),
    children: [],
    metadata: {
      attributes: {},
      ...metadata,
    },
    visible: true,
    interactable: type !== 'root',
  };
}

// ─── Layout Engines ──────────────────────────────────────────────────

/**
 * Arrange items in a spatial grid (rows x columns on a plane).
 */
export function gridLayout(count: number, spacing = 1.5, columns = 5): Vec3[] {
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    positions.push(vec3(
      col * spacing - ((Math.min(count, columns) - 1) * spacing) / 2,
      0,
      row * spacing
    ));
  }
  return positions;
}

/**
 * Arrange items in a radial pattern around the origin.
 */
export function radialLayout(count: number, radius = 3, yOffset = 0): Vec3[] {
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    positions.push(vec3(
      Math.cos(angle) * radius,
      yOffset,
      Math.sin(angle) * radius
    ));
  }
  return positions;
}

/**
 * Arrange items along a timeline (linear on X axis).
 */
export function timelineLayout(count: number, spacing = 2): Vec3[] {
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(vec3(i * spacing, 0, 0));
  }
  return positions;
}

/**
 * Arrange items in an arc in front of the user.
 */
export function arcLayout(count: number, radius = 4, arcDegrees = 120, height = 1.5): Vec3[] {
  const positions: Vec3[] = [];
  const arcRad = (arcDegrees * Math.PI) / 180;
  const startAngle = -arcRad / 2;
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (arcRad * i) / Math.max(count - 1, 1);
    positions.push(vec3(
      Math.sin(angle) * radius,
      height,
      -Math.cos(angle) * radius
    ));
  }
  return positions;
}

/**
 * Exploded view layout — offsets items outward from a center point by level.
 */
export function explodedLayout(
  items: { level: number; index: number; total: number }[],
  baseSpacing = 1.0,
  levelSpacing = 2.0
): Vec3[] {
  return items.map(item => {
    const angle = (2 * Math.PI * item.index) / Math.max(item.total, 1);
    const radius = item.level * levelSpacing;
    return vec3(
      Math.cos(angle) * radius,
      item.level * baseSpacing,
      Math.sin(angle) * radius
    );
  });
}

// ─── PLM → XR Data Transformers ──────────────────────────────────────

/**
 * Transform a flat list of Windchill parts into a spatial scene.
 */
export function partsToScene(
  parts: Record<string, unknown>[],
  layout: DataMappingType = 'grid_layout',
  sceneName = 'Part Search Results'
): XRScene {
  const root = createSceneNode('Root', 'root');

  let positions: Vec3[];
  switch (layout) {
    case 'radial_layout':
      positions = radialLayout(parts.length);
      break;
    case 'timeline':
      positions = timelineLayout(parts.length);
      break;
    default:
      positions = gridLayout(parts.length);
  }

  parts.forEach((part, i) => {
    const node = createSceneNode(
      (part.Name as string) || `Part ${i}`,
      'part',
      transformAt(positions[i].x, positions[i].y, positions[i].z),
      {
        windchillId: part.ID as string,
        windchillType: 'wt.part.WTPart',
        number: part.Number as string,
        state: part.State as string,
        version: part.Version as string,
        sourceAgent: 'part',
        attributes: flattenAttributes(part),
      }
    );
    node.interactable = true;
    root.children.push(node);
  });

  return buildScene(root, sceneName);
}

/**
 * Transform a BOM structure into a spatial exploded/assembled view.
 */
export function bomToSpatialBOM(
  bomData: Record<string, unknown>,
  layout: 'exploded' | 'assembled' | 'layered' = 'exploded',
  spacing = 1.5
): SpatialBOMNode {
  const rootPart = bomData as Record<string, unknown>;
  const children = (rootPart.Uses as Record<string, unknown>[]) || [];

  return buildSpatialBOMNode(rootPart, children, 0, 0, children.length, layout, spacing);
}

function buildSpatialBOMNode(
  part: Record<string, unknown>,
  children: Record<string, unknown>[],
  level: number,
  index: number,
  totalAtLevel: number,
  layout: 'exploded' | 'assembled' | 'layered',
  spacing: number
): SpatialBOMNode {
  // Assembled: everything at origin. Exploded: spread out by level.
  const angle = totalAtLevel > 0 ? (2 * Math.PI * index) / totalAtLevel : 0;
  const radius = level * spacing * 2;

  const assembledPos = vec3(0, 0, 0);
  const explodedPos = vec3(
    Math.cos(angle) * radius,
    layout === 'layered' ? level * spacing : 0,
    Math.sin(angle) * radius
  );

  const node: SpatialBOMNode = {
    partId: (part.ID as string) || '',
    partNumber: (part.Number as string) || '',
    partName: (part.Name as string) || '',
    level,
    quantity: (part.Quantity as number) || 1,
    transform: {
      position: layout === 'assembled' ? assembledPos : explodedPos,
      rotation: quaternionIdentity(),
      scale: vec3(1, 1, 1),
    },
    explodedTransform: {
      position: explodedPos,
      rotation: quaternionIdentity(),
      scale: vec3(1, 1, 1),
    },
    state: part.State as string,
    children: [],
  };

  if (children.length > 0) {
    node.children = children.map((child, i) => {
      const subChildren = (child.Uses as Record<string, unknown>[]) || [];
      return buildSpatialBOMNode(child, subChildren, level + 1, i, children.length, layout, spacing);
    });
  }

  return node;
}

/**
 * Transform Windchill change data into a spatial change review.
 */
export function changeToSpatialReview(
  change: Record<string, unknown>,
  affectedParts: Record<string, unknown>[] = []
): SpatialChangeReview {
  const markers: SpatialChangeMarker[] = [];
  const positions = radialLayout(affectedParts.length, 3);

  affectedParts.forEach((part, i) => {
    markers.push({
      partId: (part.ID as string) || '',
      partNumber: (part.Number as string) || '',
      markerPosition: positions[i],
      changeType: 'modified',
      color: '#ff9900',
    });
  });

  return {
    changeId: (change.ID as string) || '',
    changeName: (change.Name as string) || '',
    changeState: (change.State as string) || '',
    priority: (change.Priority as string) || 'Medium',
    affectedParts: markers,
    panelTransform: transformAt(0, 1.6, -2),
  };
}

/**
 * Transform workflow items into a spatial dashboard.
 */
export function workflowToSpatialDashboard(
  items: Record<string, unknown>[],
  layoutType: DashboardLayout['type'] = 'arc'
): SpatialWorkflowDashboard {
  let positions: Vec3[];
  switch (layoutType) {
    case 'arc':
      positions = arcLayout(items.length);
      break;
    case 'timeline':
      positions = timelineLayout(items.length);
      break;
    case 'grid':
      positions = gridLayout(items.length, 1.2, 4);
      break;
    default:
      positions = gridLayout(items.length);
  }

  const spatialItems: SpatialWorkflowItem[] = items.map((item, i) => ({
    taskId: (item.ID as string) || '',
    taskName: (item.Name as string) || `Task ${i}`,
    assignee: (item.Assignee as string) || 'Unassigned',
    dueDate: item.DueDate as string,
    state: (item.State as string) || 'Open',
    position: positions[i],
    urgencyColor: getUrgencyColor(item.DueDate as string, item.State as string),
  }));

  return {
    workflowItems: spatialItems,
    layout: { type: layoutType, spacing: 1.2 },
    panelTransform: transformAt(0, 1.5, -3),
  };
}

/**
 * Build documents into floating panels arranged spatially.
 */
export function documentsToScene(
  documents: Record<string, unknown>[],
  layout: DataMappingType = 'grid_layout'
): XRScene {
  const root = createSceneNode('Root', 'root');
  const positions = layout === 'radial_layout'
    ? radialLayout(documents.length)
    : gridLayout(documents.length, 1.8, 4);

  documents.forEach((doc, i) => {
    const node = createSceneNode(
      (doc.Name as string) || `Document ${i}`,
      'document',
      transformAt(positions[i].x, positions[i].y + 1.5, positions[i].z),
      {
        windchillId: doc.ID as string,
        windchillType: 'wt.doc.WTDocument',
        number: doc.Number as string,
        state: doc.State as string,
        version: doc.Version as string,
        sourceAgent: 'document',
        attributes: flattenAttributes(doc),
      }
    );
    root.children.push(node);
  });

  return buildScene(root, 'Document View');
}

// ─── Scene Builders ──────────────────────────────────────────────────

export function buildScene(
  rootNode: SceneNode,
  name: string,
  description = ''
): XRScene {
  const now = new Date().toISOString();
  return {
    id: `scene_${Date.now()}`,
    name,
    description: description || `Spatial view: ${name}`,
    createdAt: now,
    updatedAt: now,
    rootNode,
    environment: defaultEnvironment(),
    dataSources: [],
    interactionMode: 'inspect',
  };
}

export function defaultEnvironment(): XREnvironment {
  return {
    type: 'grid',
    skyboxColor: '#1a1a2e',
    groundPlane: true,
    gridVisible: true,
    ambientLightIntensity: 0.4,
    directionalLightIntensity: 0.8,
  };
}

export function createSession(
  userId: string,
  sceneId: string,
  headsetType: XRSessionState['headsetType'] = 'quest_3',
  activeServerId = 1
): XRSessionState {
  const now = new Date().toISOString();
  return {
    sessionId: `xr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    userId,
    activeSceneId: sceneId,
    headsetType,
    currentTransform: identityTransform(),
    selectedNodeIds: [],
    interactionMode: 'inspect',
    connectedAt: now,
    lastActiveAt: now,
    activeServerId,
  };
}

export function buildHandoff(
  scene: XRScene,
  session: XRSessionState,
  serverEndpoint: string,
  dataSnapshot: Record<string, unknown> = {}
): XRHandoffPayload {
  return {
    scene,
    session,
    dataSnapshot,
    serverEndpoint,
    refreshEndpoints: [],
  };
}

// ─── Utilities ───────────────────────────────────────────────────────

function flattenAttributes(obj: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

function getUrgencyColor(dueDate?: string, state?: string): string {
  if (state === 'Completed') return '#4caf50';    // green
  if (!dueDate) return '#9e9e9e';                  // gray

  const due = new Date(dueDate);
  const now = new Date();
  const daysLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 0) return '#f44336';              // red — overdue
  if (daysLeft < 2) return '#ff9800';              // orange — soon
  if (daysLeft < 7) return '#ffeb3b';              // yellow — this week
  return '#2196f3';                                 // blue — comfortable
}

/**
 * Compute a bounding box from a set of positions.
 */
export function computeBoundingBox(positions: Vec3[]): BoundingBox {
  if (positions.length === 0) {
    return { min: vec3(), max: vec3(), center: vec3(), extents: vec3() };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const p of positions) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    min: vec3(minX, minY, minZ),
    max: vec3(maxX, maxY, maxZ),
    center: vec3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    extents: vec3((maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2),
  };
}
