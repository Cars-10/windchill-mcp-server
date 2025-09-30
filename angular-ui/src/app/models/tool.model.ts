export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: { [key: string]: any };
    required?: string[];
  };
  agent: string;
  category: string;
}