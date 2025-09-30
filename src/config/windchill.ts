import dotenv from 'dotenv';
dotenv.config();

export const windchillConfig = {
  baseURL: process.env.WINDCHILL_URL || 'http://plm.windchill.com/Windchill',
  username: process.env.WINDCHILL_USER || '',
  password: process.env.WINDCHILL_PASSWORD || '',
  timeout: 30000,
  apiPath: '/servlet/odata',
};

export const apiEndpoints = {
  parts: '/ProdMgmt/Parts',
  documents: '/DocMgmt/Documents',
  changes: '/ChangeMgmt/ChangeRequests',
  workflows: '/WorkflowMgmt/WorkItems',
  projects: '/ProjMgmt/Projects',
};
