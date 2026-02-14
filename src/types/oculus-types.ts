/**
 * Type definitions for Oculus/XR spatial integration with Windchill PLM data.
 *
 * These types define the spatial representations, scene graphs, and
 * XR-compatible data structures used to bridge Windchill PLM objects
 * into immersive 3D environments (Meta Quest, WebXR, etc.).
 */

/**
 * 3D vector for position, rotation, scale
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion rotation
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Spatial transform for placing objects in 3D space
 */
export interface SpatialTransform {
  position: Vec3;
  rotation: Quaternion;
  scale: Vec3;
}

/**
 * Bounding box for spatial objects
 */
export interface BoundingBox {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  extents: Vec3;
}

/**
 * A node in the XR scene graph
 */
export interface SceneNode {
  id: string;
  name: string;
  type: SceneNodeType;
  transform: SpatialTransform;
  boundingBox?: BoundingBox;
  children: SceneNode[];
  metadata: SceneNodeMetadata;
  visible: boolean;
  interactable: boolean;
}

/**
 * Types of scene nodes
 */
export type SceneNodeType =
  | 'root'
  | 'assembly'
  | 'part'
  | 'document'
  | 'annotation'
  | 'measurement'
  | 'section_plane'
  | 'change_marker'
  | 'workflow_panel'
  | 'data_panel'
  | 'spatial_anchor';

/**
 * Metadata attached to a scene node, linking back to Windchill PLM data
 */
export interface SceneNodeMetadata {
  windchillId?: string;
  windchillType?: string;
  number?: string;
  state?: string;
  version?: string;
  containerName?: string;
  /** Source agent that provided this data */
  sourceAgent?: string;
  /** Additional key-value pairs from PLM */
  attributes: Record<string, string | number | boolean>;
}

/**
 * Complete XR scene definition
 */
export interface XRScene {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  rootNode: SceneNode;
  environment: XREnvironment;
  dataSources: DataSourceBinding[];
  interactionMode: InteractionMode;
}

/**
 * XR environment/skybox configuration
 */
export interface XREnvironment {
  type: 'void' | 'grid' | 'workshop' | 'warehouse' | 'office' | 'custom';
  skyboxColor?: string;
  groundPlane: boolean;
  gridVisible: boolean;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}

/**
 * Binding between an XR scene element and a Windchill data source
 */
export interface DataSourceBinding {
  bindingId: string;
  agentName: string;
  toolName: string;
  parameters: Record<string, string | number | boolean>;
  refreshIntervalMs: number;
  targetNodeId: string;
  mappingType: DataMappingType;
}

/**
 * How PLM data maps into the spatial scene
 */
export type DataMappingType =
  | 'bom_explode'       // BOM hierarchy → exploded 3D assembly
  | 'grid_layout'       // List results → spatial grid
  | 'radial_layout'     // Related items → radial arrangement
  | 'timeline'          // Date-based data → spatial timeline
  | 'heatmap'           // Numeric values → color-coded surfaces
  | 'tree_layout'       // Hierarchy → 3D tree structure
  | 'dashboard_panel';  // Key-value data → floating panel

/**
 * User interaction mode
 */
export type InteractionMode =
  | 'inspect'     // Look and examine
  | 'navigate'    // Move through scene
  | 'select'      // Pick objects for details
  | 'annotate'    // Add spatial annotations
  | 'measure'     // Spatial measurements
  | 'compare';    // Side-by-side comparison

/**
 * Spatial BOM node — a part in an exploded/assembled view
 */
export interface SpatialBOMNode {
  partId: string;
  partNumber: string;
  partName: string;
  level: number;
  quantity: number;
  transform: SpatialTransform;
  explodedTransform: SpatialTransform;
  visualizationUrl?: string;
  thumbnailUrl?: string;
  state?: string;
  children: SpatialBOMNode[];
}

/**
 * A spatial annotation pinned to a 3D location
 */
export interface SpatialAnnotation {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  anchorNodeId: string;
  anchorPosition: Vec3;
  color: string;
  linkedChangeId?: string;
  linkedWorkflowId?: string;
}

/**
 * Spatial change review — positions change request data in 3D
 */
export interface SpatialChangeReview {
  changeId: string;
  changeName: string;
  changeState: string;
  priority: string;
  affectedParts: SpatialChangeMarker[];
  panelTransform: SpatialTransform;
}

/**
 * Marker on a part affected by a change
 */
export interface SpatialChangeMarker {
  partId: string;
  partNumber: string;
  markerPosition: Vec3;
  changeType: 'added' | 'modified' | 'removed';
  color: string;
}

/**
 * Spatial workflow dashboard — floating panels for workflow items
 */
export interface SpatialWorkflowDashboard {
  workflowItems: SpatialWorkflowItem[];
  layout: DashboardLayout;
  panelTransform: SpatialTransform;
}

/**
 * A workflow item positioned in 3D space
 */
export interface SpatialWorkflowItem {
  taskId: string;
  taskName: string;
  assignee: string;
  dueDate?: string;
  state: string;
  position: Vec3;
  urgencyColor: string;
}

/**
 * Layout strategies for dashboard panels
 */
export interface DashboardLayout {
  type: 'grid' | 'arc' | 'stack' | 'timeline';
  columns?: number;
  spacing: number;
  curvature?: number;
}

/**
 * XR session state for tracking user context
 */
export interface XRSessionState {
  sessionId: string;
  userId: string;
  activeSceneId: string;
  headsetType: 'quest_3' | 'quest_pro' | 'quest_2' | 'webxr' | 'desktop_preview';
  currentTransform: SpatialTransform;
  selectedNodeIds: string[];
  interactionMode: InteractionMode;
  connectedAt: string;
  lastActiveAt: string;
  activeServerId: number;
}

/**
 * Handoff payload — sent to an XR client to render a scene
 */
export interface XRHandoffPayload {
  scene: XRScene;
  session: XRSessionState;
  dataSnapshot: Record<string, unknown>;
  serverEndpoint: string;
  refreshEndpoints: RefreshEndpoint[];
}

/**
 * An endpoint the XR client can poll for live data updates
 */
export interface RefreshEndpoint {
  label: string;
  url: string;
  method: 'GET' | 'POST';
  intervalMs: number;
  targetNodeId: string;
}

/**
 * Parameters for building a spatial BOM
 */
export interface SpatialBOMParams {
  partId: string;
  levels?: number;
  layout?: 'exploded' | 'assembled' | 'layered';
  spacing?: number;
  includeVisualization?: boolean;
}

/**
 * Parameters for creating a change review scene
 */
export interface ChangeReviewSceneParams {
  changeId: string;
  includeAffectedParts?: boolean;
  includeResultingParts?: boolean;
  layout?: 'radial' | 'linear' | 'grouped';
}

/**
 * Parameters for creating a workflow dashboard
 */
export interface WorkflowDashboardParams {
  assignee?: string;
  processName?: string;
  layout?: DashboardLayout['type'];
  maxItems?: number;
}

/**
 * Parameters for searching and placing parts spatially
 */
export interface SpatialSearchParams {
  query?: string;
  number?: string;
  name?: string;
  state?: string;
  layout?: DataMappingType;
  maxResults?: number;
}
