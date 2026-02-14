/**
 * OculusAgent — XR/Spatial Integration Agent for Windchill PLM
 *
 * Bridges all Windchill data streams (parts, BOMs, documents, changes,
 * workflows, projects, visualization) into immersive 3D spatial
 * representations for Meta Quest headsets and WebXR clients.
 *
 * **Capabilities:**
 * - Spatial BOM exploration (exploded/assembled/layered views)
 * - Immersive part search with spatial layouts
 * - 3D change review environments
 * - Spatial workflow dashboards
 * - Document galleries in VR
 * - Scene management (create, configure, export)
 * - XR session management
 * - Spatial annotations
 * - Project overview in 3D space
 * - Multi-agent data fusion into unified scenes
 *
 * **Data Streams Used:**
 * - PartAgent (parts, BOM structures)
 * - DocumentAgent (documents, content)
 * - ChangeAgent (change requests, affected objects)
 * - WorkflowAgent (workflow items, tasks)
 * - ProjectAgent (projects, team data)
 * - VisualizationAgent (thumbnails, 3D representations)
 * - DataAdminAgent (containers, contexts)
 */

import { BaseAgent } from './base-agent.js';
import { apiEndpoints } from '../config/windchill.js';
import { ToolParams, ToolResult } from '../types/common.js';
import {
  partsToScene,
  bomToSpatialBOM,
  changeToSpatialReview,
  workflowToSpatialDashboard,
  documentsToScene,
  buildScene,
  createSceneNode,
  createSession,
  buildHandoff,
  defaultEnvironment,
  transformAt,
  gridLayout,
  radialLayout,
  arcLayout,
  vec3,
  identityTransform,
} from '../services/oculus-bridge.js';
import type {
  XRScene,
  XRSessionState,
  SpatialAnnotation,
  DataMappingType,
  DashboardLayout,
  InteractionMode,
} from '../types/oculus-types.js';

export class OculusAgent extends BaseAgent {
  protected agentName = 'oculus';

  // In-memory stores (would be persisted in production)
  private scenes: Map<string, XRScene> = new Map();
  private sessions: Map<string, XRSessionState> = new Map();
  private annotations: Map<string, SpatialAnnotation[]> = new Map();

  protected tools = [
    // ──────────────────────────────────────────────────────────────
    // 1. SPATIAL BOM EXPLORATION
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_bom',
      description: 'Create a spatial 3D BOM (Bill of Materials) view from a Windchill part. Returns an exploded, assembled, or layered spatial representation of the part hierarchy for rendering in VR/XR. Uses the PartAgent BOM data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            description: 'Windchill Part OID to build spatial BOM from'
          },
          layout: {
            type: 'string',
            enum: ['exploded', 'assembled', 'layered'],
            description: 'Spatial layout style (default: exploded)'
          },
          levels: {
            type: 'number',
            description: 'Max BOM levels to traverse (default: 3)'
          },
          spacing: {
            type: 'number',
            description: 'Spacing multiplier between parts (default: 1.5)'
          }
        },
        required: ['partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const partId = params.partId as string;
        const layout = (params.layout as 'exploded' | 'assembled' | 'layered') || 'exploded';
        const levels = (params.levels as number) || 3;
        const spacing = (params.spacing as number) || 1.5;

        // Fetch BOM data from Windchill
        const bomResponse = await this.api.get(
          `${apiEndpoints.parts}('${partId}')/Uses`,
          { $expand: 'Uses($levels=' + levels + ')' }
        );

        // Fetch the root part details
        const partResponse = await this.api.get(
          `${apiEndpoints.parts}('${partId}')`
        );

        const rootData = { ...partResponse.data, Uses: bomResponse.data?.value || [] };
        const spatialBOM = bomToSpatialBOM(rootData, layout, spacing);

        // Build a complete scene around the BOM
        const root = createSceneNode('BOM Root', 'root');
        const assemblyNode = createSceneNode(
          spatialBOM.partName || 'Assembly',
          'assembly',
          identityTransform(),
          {
            windchillId: partId,
            number: spatialBOM.partNumber,
            sourceAgent: 'part',
            attributes: {},
          }
        );
        root.children.push(assemblyNode);

        const scene = buildScene(root, `BOM: ${spatialBOM.partName}`);
        this.scenes.set(scene.id, scene);

        return {
          scene,
          spatialBOM,
          stats: {
            totalParts: countBOMNodes(spatialBOM),
            levels: countBOMLevels(spatialBOM),
            layout,
          }
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 2. SPATIAL PART SEARCH
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_part_search',
      description: 'Search Windchill parts and return results arranged in a spatial layout for VR/XR viewing. Choose from grid, radial, or timeline layouts. Uses the PartAgent search data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Part number filter (supports wildcards)'
          },
          name: {
            type: 'string',
            description: 'Part name filter'
          },
          layout: {
            type: 'string',
            enum: ['grid_layout', 'radial_layout', 'timeline'],
            description: 'Spatial arrangement of results (default: grid_layout)'
          },
          limit: {
            type: 'number',
            description: 'Max results (default: 20)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const filters: string[] = [];
        if (params.number) filters.push(`contains(Number,'${params.number}')`);
        if (params.name) filters.push(`contains(Name,'${params.name}')`);

        const queryParams: Record<string, string> = {};
        if (filters.length > 0) queryParams['$filter'] = filters.join(' and ');
        queryParams['$top'] = String((params.limit as number) || 20);

        const response = await this.api.get(apiEndpoints.parts, queryParams);
        const parts = response.data?.value || [];

        const layout = (params.layout as DataMappingType) || 'grid_layout';
        const scene = partsToScene(parts, layout, 'Part Search Results');
        this.scenes.set(scene.id, scene);

        return {
          scene,
          resultCount: parts.length,
          layout,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 3. SPATIAL CHANGE REVIEW
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_change_review',
      description: 'Create a spatial change review environment. Visualizes a Windchill change request with its affected parts positioned in 3D space, marked with change type indicators. Uses the ChangeAgent data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          changeId: {
            type: 'string',
            description: 'Windchill Change Request OID'
          },
          includeAffectedParts: {
            type: 'boolean',
            description: 'Include affected parts in spatial view (default: true)'
          }
        },
        required: ['changeId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const changeId = params.changeId as string;
        const includeAffected = params.includeAffectedParts !== false;

        // Fetch change request data
        const changeResponse = await this.api.get(
          `${apiEndpoints.changes}('${changeId}')`
        );

        let affectedParts: Record<string, unknown>[] = [];
        if (includeAffected) {
          try {
            const affectedResponse = await this.api.get(
              `${apiEndpoints.changes}('${changeId}')/AffectedObjects`
            );
            affectedParts = affectedResponse.data?.value || [];
          } catch {
            // Affected objects endpoint may not be available
          }
        }

        const review = changeToSpatialReview(changeResponse.data, affectedParts);

        // Build scene
        const root = createSceneNode('Change Review Root', 'root');
        const changePanel = createSceneNode(
          review.changeName,
          'change_marker',
          review.panelTransform,
          {
            windchillId: changeId,
            state: review.changeState,
            sourceAgent: 'change',
            attributes: { priority: review.priority },
          }
        );
        root.children.push(changePanel);

        // Add affected part markers
        review.affectedParts.forEach(marker => {
          const partNode = createSceneNode(
            marker.partNumber,
            'part',
            transformAt(marker.markerPosition.x, marker.markerPosition.y, marker.markerPosition.z),
            {
              windchillId: marker.partId,
              number: marker.partNumber,
              sourceAgent: 'change',
              attributes: { changeType: marker.changeType, color: marker.color },
            }
          );
          root.children.push(partNode);
        });

        const scene = buildScene(root, `Change Review: ${review.changeName}`);
        this.scenes.set(scene.id, scene);

        return {
          scene,
          review,
          affectedPartCount: affectedParts.length,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 4. SPATIAL WORKFLOW DASHBOARD
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_workflow_dashboard',
      description: 'Create a spatial workflow dashboard showing Windchill workflow items as floating panels in VR/XR. Color-coded by urgency. Uses the WorkflowAgent data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          assignee: {
            type: 'string',
            description: 'Filter by assignee'
          },
          processName: {
            type: 'string',
            description: 'Filter by workflow process name'
          },
          layout: {
            type: 'string',
            enum: ['arc', 'grid', 'timeline', 'stack'],
            description: 'Dashboard layout style (default: arc)'
          },
          maxItems: {
            type: 'number',
            description: 'Maximum items to show (default: 15)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const filters: string[] = [];
        if (params.assignee) filters.push(`Assignee eq '${params.assignee}'`);
        if (params.processName) filters.push(`contains(ProcessName,'${params.processName}')`);

        const queryParams: Record<string, string> = {};
        if (filters.length > 0) queryParams['$filter'] = filters.join(' and ');
        queryParams['$top'] = String((params.maxItems as number) || 15);

        const response = await this.api.get(apiEndpoints.workflows, queryParams);
        const items = response.data?.value || [];

        const layoutType = (params.layout as DashboardLayout['type']) || 'arc';
        const dashboard = workflowToSpatialDashboard(items, layoutType);

        // Build scene
        const root = createSceneNode('Workflow Dashboard Root', 'root');
        dashboard.workflowItems.forEach(item => {
          const panel = createSceneNode(
            item.taskName,
            'workflow_panel',
            transformAt(item.position.x, item.position.y, item.position.z),
            {
              windchillId: item.taskId,
              state: item.state,
              sourceAgent: 'workflow',
              attributes: {
                assignee: item.assignee,
                urgencyColor: item.urgencyColor,
                ...(item.dueDate ? { dueDate: item.dueDate } : {}),
              },
            }
          );
          root.children.push(panel);
        });

        const scene = buildScene(root, 'Workflow Dashboard');
        this.scenes.set(scene.id, scene);

        return {
          scene,
          dashboard,
          itemCount: items.length,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 5. SPATIAL DOCUMENT GALLERY
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_document_gallery',
      description: 'Create a spatial document gallery in VR/XR. Windchill documents displayed as floating panels with metadata. Uses the DocumentAgent data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Document number filter'
          },
          name: {
            type: 'string',
            description: 'Document name filter'
          },
          type: {
            type: 'string',
            description: 'Document type filter'
          },
          layout: {
            type: 'string',
            enum: ['grid_layout', 'radial_layout'],
            description: 'Gallery layout (default: grid_layout)'
          },
          limit: {
            type: 'number',
            description: 'Max documents (default: 20)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const filters: string[] = [];
        if (params.number) filters.push(`contains(Number,'${params.number}')`);
        if (params.name) filters.push(`contains(Name,'${params.name}')`);
        if (params.type) filters.push(`Type eq '${params.type}'`);

        const queryParams: Record<string, string> = {};
        if (filters.length > 0) queryParams['$filter'] = filters.join(' and ');
        queryParams['$top'] = String((params.limit as number) || 20);

        const response = await this.api.get(apiEndpoints.documents, queryParams);
        const docs = response.data?.value || [];

        const layout = (params.layout as DataMappingType) || 'grid_layout';
        const scene = documentsToScene(docs, layout);
        this.scenes.set(scene.id, scene);

        return {
          scene,
          documentCount: docs.length,
          layout,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 6. SPATIAL PROJECT OVERVIEW
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_project_overview',
      description: 'Create a spatial overview of Windchill projects. Projects are arranged as interactive nodes in 3D space with status information. Uses the ProjectAgent data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max projects to display (default: 10)'
          },
          layout: {
            type: 'string',
            enum: ['grid_layout', 'radial_layout'],
            description: 'Layout style (default: radial_layout)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const queryParams: Record<string, string> = {
          '$top': String((params.limit as number) || 10),
        };

        const response = await this.api.get(apiEndpoints.projects, queryParams);
        const projects = response.data?.value || [];

        const layout = (params.layout as string) || 'radial_layout';
        const positions = layout === 'radial_layout'
          ? radialLayout(projects.length, 5)
          : gridLayout(projects.length, 2.5, 4);

        const root = createSceneNode('Projects Root', 'root');
        projects.forEach((project: Record<string, unknown>, i: number) => {
          const node = createSceneNode(
            (project.Name as string) || `Project ${i}`,
            'data_panel',
            transformAt(positions[i].x, positions[i].y + 1.2, positions[i].z),
            {
              windchillId: project.ID as string,
              windchillType: 'wt.projmgmt.admin.Project2',
              sourceAgent: 'project',
              attributes: {
                ...(project.Manager ? { manager: project.Manager as string } : {}),
                ...(project.State ? { state: project.State as string } : {}),
                ...(project.StartDate ? { startDate: project.StartDate as string } : {}),
                ...(project.EndDate ? { endDate: project.EndDate as string } : {}),
              },
            }
          );
          root.children.push(node);
        });

        const scene = buildScene(root, 'Project Overview');
        this.scenes.set(scene.id, scene);

        return {
          scene,
          projectCount: projects.length,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 7. MULTI-STREAM SCENE (fuses multiple data sources)
    // ──────────────────────────────────────────────────────────────
    {
      name: 'create_multistream_scene',
      description: 'Create a unified XR scene that fuses data from multiple Windchill agents. Combines parts, documents, changes, and workflow items into a single spatial environment. This is the "doom-ified" view of all your PLM data streams.',
      inputSchema: {
        type: 'object',
        properties: {
          includeParts: {
            type: 'boolean',
            description: 'Include recent parts (default: true)'
          },
          includeDocuments: {
            type: 'boolean',
            description: 'Include recent documents (default: true)'
          },
          includeChanges: {
            type: 'boolean',
            description: 'Include open changes (default: true)'
          },
          includeWorkflows: {
            type: 'boolean',
            description: 'Include active workflow items (default: true)'
          },
          maxPerStream: {
            type: 'number',
            description: 'Max items per data stream (default: 10)'
          },
          environment: {
            type: 'string',
            enum: ['void', 'grid', 'workshop', 'warehouse', 'office'],
            description: 'Scene environment (default: grid)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const maxPer = (params.maxPerStream as number) || 10;
        const root = createSceneNode('Multistream Root', 'root');
        const stats: Record<string, number> = {};

        // Quadrant layout: each stream occupies a spatial quadrant
        // Parts: front-left, Documents: front-right,
        // Changes: back-left, Workflows: back-right

        if (params.includeParts !== false) {
          try {
            const resp = await this.api.get(apiEndpoints.parts, { '$top': String(maxPer) });
            const parts = resp.data?.value || [];
            stats.parts = parts.length;

            const positions = gridLayout(parts.length, 1.2, 3);
            parts.forEach((part: Record<string, unknown>, i: number) => {
              const node = createSceneNode(
                (part.Name as string) || `Part ${i}`,
                'part',
                transformAt(positions[i].x - 6, 1, positions[i].z - 3),
                {
                  windchillId: part.ID as string,
                  number: part.Number as string,
                  state: part.State as string,
                  sourceAgent: 'part',
                  attributes: {},
                }
              );
              root.children.push(node);
            });
          } catch { stats.parts = 0; }
        }

        if (params.includeDocuments !== false) {
          try {
            const resp = await this.api.get(apiEndpoints.documents, { '$top': String(maxPer) });
            const docs = resp.data?.value || [];
            stats.documents = docs.length;

            const positions = gridLayout(docs.length, 1.2, 3);
            docs.forEach((doc: Record<string, unknown>, i: number) => {
              const node = createSceneNode(
                (doc.Name as string) || `Doc ${i}`,
                'document',
                transformAt(positions[i].x + 6, 1.5, positions[i].z - 3),
                {
                  windchillId: doc.ID as string,
                  number: doc.Number as string,
                  state: doc.State as string,
                  sourceAgent: 'document',
                  attributes: {},
                }
              );
              root.children.push(node);
            });
          } catch { stats.documents = 0; }
        }

        if (params.includeChanges !== false) {
          try {
            const resp = await this.api.get(apiEndpoints.changes, { '$top': String(maxPer) });
            const changes = resp.data?.value || [];
            stats.changes = changes.length;

            const positions = gridLayout(changes.length, 1.5, 3);
            changes.forEach((change: Record<string, unknown>, i: number) => {
              const node = createSceneNode(
                (change.Name as string) || `Change ${i}`,
                'change_marker',
                transformAt(positions[i].x - 6, 1.2, positions[i].z + 5),
                {
                  windchillId: change.ID as string,
                  state: change.State as string,
                  sourceAgent: 'change',
                  attributes: {
                    ...(change.Priority ? { priority: change.Priority as string } : {}),
                  },
                }
              );
              root.children.push(node);
            });
          } catch { stats.changes = 0; }
        }

        if (params.includeWorkflows !== false) {
          try {
            const resp = await this.api.get(apiEndpoints.workflows, { '$top': String(maxPer) });
            const workflows = resp.data?.value || [];
            stats.workflows = workflows.length;

            const positions = arcLayout(workflows.length, 5, 90, 1.5);
            workflows.forEach((wf: Record<string, unknown>, i: number) => {
              const node = createSceneNode(
                (wf.Name as string) || `Task ${i}`,
                'workflow_panel',
                transformAt(positions[i].x + 6, positions[i].y, positions[i].z + 5),
                {
                  windchillId: wf.ID as string,
                  state: wf.State as string,
                  sourceAgent: 'workflow',
                  attributes: {
                    ...(wf.Assignee ? { assignee: wf.Assignee as string } : {}),
                  },
                }
              );
              root.children.push(node);
            });
          } catch { stats.workflows = 0; }
        }

        const scene = buildScene(root, 'PLM Multistream Overview');
        scene.environment = {
          ...defaultEnvironment(),
          type: (params.environment as XRScene['environment']['type']) || 'grid',
        };
        this.scenes.set(scene.id, scene);

        return {
          scene,
          stats,
          totalNodes: root.children.length,
          quadrants: {
            frontLeft: 'Parts',
            frontRight: 'Documents',
            backLeft: 'Changes',
            backRight: 'Workflows',
          }
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 8. SCENE MANAGEMENT
    // ──────────────────────────────────────────────────────────────
    {
      name: 'list_scenes',
      description: 'List all created XR scenes available for viewing in VR/XR.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (_params: ToolParams): Promise<ToolResult> => {
        const scenes = Array.from(this.scenes.values()).map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          createdAt: s.createdAt,
          nodeCount: countSceneNodes(s.rootNode),
          environment: s.environment.type,
          interactionMode: s.interactionMode,
        }));

        return { scenes, count: scenes.length };
      }
    },

    {
      name: 'get_scene',
      description: 'Get the full scene graph for a specific XR scene.',
      inputSchema: {
        type: 'object',
        properties: {
          sceneId: {
            type: 'string',
            description: 'Scene ID to retrieve'
          }
        },
        required: ['sceneId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const scene = this.scenes.get(params.sceneId as string);
        if (!scene) {
          return { error: 'Scene not found', sceneId: params.sceneId };
        }
        return scene;
      }
    },

    {
      name: 'configure_scene',
      description: 'Update scene settings — environment, interaction mode, lighting.',
      inputSchema: {
        type: 'object',
        properties: {
          sceneId: {
            type: 'string',
            description: 'Scene ID to configure'
          },
          environment: {
            type: 'string',
            enum: ['void', 'grid', 'workshop', 'warehouse', 'office'],
            description: 'Scene environment type'
          },
          interactionMode: {
            type: 'string',
            enum: ['inspect', 'navigate', 'select', 'annotate', 'measure', 'compare'],
            description: 'User interaction mode'
          },
          ambientLight: {
            type: 'number',
            description: 'Ambient light intensity (0-1)'
          },
          directionalLight: {
            type: 'number',
            description: 'Directional light intensity (0-1)'
          },
          groundPlane: {
            type: 'boolean',
            description: 'Show ground plane'
          },
          gridVisible: {
            type: 'boolean',
            description: 'Show grid overlay'
          }
        },
        required: ['sceneId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const scene = this.scenes.get(params.sceneId as string);
        if (!scene) {
          return { error: 'Scene not found', sceneId: params.sceneId };
        }

        if (params.environment) {
          scene.environment.type = params.environment as XRScene['environment']['type'];
        }
        if (params.interactionMode) {
          scene.interactionMode = params.interactionMode as InteractionMode;
        }
        if (params.ambientLight !== undefined) {
          scene.environment.ambientLightIntensity = params.ambientLight as number;
        }
        if (params.directionalLight !== undefined) {
          scene.environment.directionalLightIntensity = params.directionalLight as number;
        }
        if (params.groundPlane !== undefined) {
          scene.environment.groundPlane = params.groundPlane as boolean;
        }
        if (params.gridVisible !== undefined) {
          scene.environment.gridVisible = params.gridVisible as boolean;
        }

        scene.updatedAt = new Date().toISOString();

        return { scene, message: 'Scene configured successfully' };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 9. XR SESSION MANAGEMENT
    // ──────────────────────────────────────────────────────────────
    {
      name: 'create_session',
      description: 'Create an XR session for a user. Returns session state and a handoff payload for the headset client.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID for the session'
          },
          sceneId: {
            type: 'string',
            description: 'Scene ID to load into the session'
          },
          headsetType: {
            type: 'string',
            enum: ['quest_3', 'quest_pro', 'quest_2', 'webxr', 'desktop_preview'],
            description: 'Target headset type (default: quest_3)'
          }
        },
        required: ['userId', 'sceneId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const scene = this.scenes.get(params.sceneId as string);
        if (!scene) {
          return { error: 'Scene not found', sceneId: params.sceneId };
        }

        const session = createSession(
          params.userId as string,
          params.sceneId as string,
          (params.headsetType as XRSessionState['headsetType']) || 'quest_3'
        );
        this.sessions.set(session.sessionId, session);

        const serverPort = process.env.MCP_SERVER_PORT || '3000';
        const handoff = buildHandoff(
          scene,
          session,
          `http://localhost:${serverPort}`
        );

        return {
          session,
          handoff,
          message: `XR session created for user ${params.userId}`,
        };
      }
    },

    {
      name: 'get_session',
      description: 'Get the current state of an XR session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID'
          }
        },
        required: ['sessionId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const session = this.sessions.get(params.sessionId as string);
        if (!session) {
          return { error: 'Session not found', sessionId: params.sessionId };
        }
        return session;
      }
    },

    {
      name: 'list_sessions',
      description: 'List all active XR sessions.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (_params: ToolParams): Promise<ToolResult> => {
        const sessions = Array.from(this.sessions.values()).map(s => ({
          sessionId: s.sessionId,
          userId: s.userId,
          headsetType: s.headsetType,
          sceneId: s.activeSceneId,
          interactionMode: s.interactionMode,
          connectedAt: s.connectedAt,
          lastActiveAt: s.lastActiveAt,
        }));

        return { sessions, count: sessions.length };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 10. SPATIAL ANNOTATIONS
    // ──────────────────────────────────────────────────────────────
    {
      name: 'add_annotation',
      description: 'Add a spatial annotation pinned to a position in an XR scene. Can be linked to a Windchill change request or workflow item.',
      inputSchema: {
        type: 'object',
        properties: {
          sceneId: {
            type: 'string',
            description: 'Scene to add annotation to'
          },
          text: {
            type: 'string',
            description: 'Annotation text'
          },
          author: {
            type: 'string',
            description: 'Author name'
          },
          anchorNodeId: {
            type: 'string',
            description: 'Node ID to anchor annotation to'
          },
          positionX: {
            type: 'number',
            description: 'X position offset from anchor'
          },
          positionY: {
            type: 'number',
            description: 'Y position offset from anchor'
          },
          positionZ: {
            type: 'number',
            description: 'Z position offset from anchor'
          },
          color: {
            type: 'string',
            description: 'Annotation color (hex, default: #ffeb3b)'
          },
          linkedChangeId: {
            type: 'string',
            description: 'Optional: link to a Windchill change request'
          },
          linkedWorkflowId: {
            type: 'string',
            description: 'Optional: link to a Windchill workflow item'
          }
        },
        required: ['sceneId', 'text', 'author']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const sceneId = params.sceneId as string;
        if (!this.scenes.has(sceneId)) {
          return { error: 'Scene not found', sceneId };
        }

        const annotation: SpatialAnnotation = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          text: params.text as string,
          author: params.author as string,
          createdAt: new Date().toISOString(),
          anchorNodeId: (params.anchorNodeId as string) || 'root',
          anchorPosition: vec3(
            (params.positionX as number) || 0,
            (params.positionY as number) || 1.5,
            (params.positionZ as number) || 0
          ),
          color: (params.color as string) || '#ffeb3b',
          linkedChangeId: params.linkedChangeId as string,
          linkedWorkflowId: params.linkedWorkflowId as string,
        };

        if (!this.annotations.has(sceneId)) {
          this.annotations.set(sceneId, []);
        }
        this.annotations.get(sceneId)!.push(annotation);

        // Add annotation node to scene
        const scene = this.scenes.get(sceneId)!;
        const annotationNode = createSceneNode(
          `Annotation: ${annotation.text.substring(0, 30)}`,
          'annotation',
          transformAt(
            annotation.anchorPosition.x,
            annotation.anchorPosition.y,
            annotation.anchorPosition.z
          ),
          {
            sourceAgent: 'oculus',
            attributes: {
              text: annotation.text,
              author: annotation.author,
              color: annotation.color,
            },
          }
        );
        scene.rootNode.children.push(annotationNode);
        scene.updatedAt = new Date().toISOString();

        return {
          annotation,
          message: 'Annotation added to scene',
        };
      }
    },

    {
      name: 'get_annotations',
      description: 'Get all spatial annotations for an XR scene.',
      inputSchema: {
        type: 'object',
        properties: {
          sceneId: {
            type: 'string',
            description: 'Scene ID'
          }
        },
        required: ['sceneId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const annotations = this.annotations.get(params.sceneId as string) || [];
        return { annotations, count: annotations.length };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 11. CONTAINER SPATIAL VIEW
    // ──────────────────────────────────────────────────────────────
    {
      name: 'spatial_containers',
      description: 'Visualize Windchill containers (products, libraries, projects) as a spatial map. Uses the DataAdminAgent data stream.',
      inputSchema: {
        type: 'object',
        properties: {
          layout: {
            type: 'string',
            enum: ['grid_layout', 'radial_layout'],
            description: 'Layout style (default: radial_layout)'
          }
        }
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const response = await this.api.get(`${apiEndpoints.containers}`);
        const containers = response.data?.value || [];

        const layout = (params.layout as string) || 'radial_layout';
        const positions = layout === 'radial_layout'
          ? radialLayout(containers.length, 6)
          : gridLayout(containers.length, 3, 4);

        const root = createSceneNode('Containers Root', 'root');
        containers.forEach((container: Record<string, unknown>, i: number) => {
          const node = createSceneNode(
            (container.Name as string) || `Container ${i}`,
            'data_panel',
            transformAt(positions[i].x, 1, positions[i].z),
            {
              windchillId: container.ID as string,
              windchillType: container.Type as string,
              sourceAgent: 'dataadmin',
              attributes: {
                ...(container.ContainerType ? { containerType: container.ContainerType as string } : {}),
              },
            }
          );
          root.children.push(node);
        });

        const scene = buildScene(root, 'Container Map');
        this.scenes.set(scene.id, scene);

        return {
          scene,
          containerCount: containers.length,
        };
      }
    },

    // ──────────────────────────────────────────────────────────────
    // 12. VISUALIZATION DATA BRIDGE
    // ──────────────────────────────────────────────────────────────
    {
      name: 'get_part_visualization',
      description: 'Get visualization/thumbnail data for a part to use in XR rendering. Bridges the VisualizationAgent data stream into spatial context.',
      inputSchema: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            description: 'Windchill Part OID'
          },
          includeThumb: {
            type: 'boolean',
            description: 'Include thumbnail URL (default: true)'
          },
          include3D: {
            type: 'boolean',
            description: 'Include 3D visualization data (default: true)'
          }
        },
        required: ['partId']
      },
      handler: async (params: ToolParams): Promise<ToolResult> => {
        const partId = params.partId as string;
        const result: Record<string, unknown> = { partId };

        if (params.includeThumb !== false) {
          try {
            const thumbResp = await this.api.get(
              `${apiEndpoints.visualization}/Thumbnails('${partId}')`
            );
            result.thumbnail = thumbResp.data;
          } catch {
            result.thumbnail = null;
          }
        }

        if (params.include3D !== false) {
          try {
            const vizResp = await this.api.get(
              `${apiEndpoints.visualization}/Representations`,
              { '$filter': `SourceObject eq '${partId}'` }
            );
            result.visualizations = vizResp.data?.value || [];
          } catch {
            result.visualizations = [];
          }
        }

        return result;
      }
    },
  ];
}

// ─── Helper Functions ────────────────────────────────────────────────

function countBOMNodes(node: { children: any[] }): number {
  return 1 + node.children.reduce((sum: number, child: any) => sum + countBOMNodes(child), 0);
}

function countBOMLevels(node: { children: any[] }, level = 0): number {
  if (node.children.length === 0) return level;
  return Math.max(...node.children.map((child: any) => countBOMLevels(child, level + 1)));
}

function countSceneNodes(node: { children: any[] }): number {
  return 1 + node.children.reduce((sum: number, child: any) => sum + countSceneNodes(child), 0);
}
