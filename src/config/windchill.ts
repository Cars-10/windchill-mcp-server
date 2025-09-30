import { serverManager } from './windchill-servers.js';

/**
 * Get current Windchill configuration from the active server
 * This function provides backward compatibility while using the new server manager
 */
export function getWindchillConfig() {
  const activeServer = serverManager.getActiveServer();
  return {
    baseURL: activeServer.baseURL,
    username: activeServer.username,
    password: activeServer.password,
    timeout: activeServer.timeout,
    apiPath: activeServer.apiPath,
  };
}

/**
 * Legacy windchillConfig export for backward compatibility
 * This will always reflect the currently active server
 */
export const windchillConfig = new Proxy({} as any, {
  get(target, prop) {
    const config = getWindchillConfig();
    return config[prop as keyof typeof config];
  }
});

export const apiEndpoints = {
  parts: '/ProdMgmt/Parts',
  documents: '/DocMgmt/Documents',
  changes: '/ChangeMgmt/ChangeRequests',
  workflows: '/WorkflowMgmt/WorkItems',
  projects: '/ProjMgmt/Projects',
};
