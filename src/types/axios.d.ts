// Extend Axios types to include our custom metadata
declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      requestId: string;
      startTime: number;
      isRetry?: boolean;
      originalRequestId?: string;
    };
  }
}