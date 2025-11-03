// Type definitions matching ToClientFormat() output from backend
export interface ClientConfig {
  core?: {
    max_content_length: number;
  };
  activity?: boolean;
  space_stats?: boolean;
  retroactive_posting?: {
    time_format: string;
  };
  file_upload?: {
    max_file_size_mb: number;
    max_files_per_post: number;
    allowed_extensions: string[];
  };
  preview?: {
    supported_formats: string[];
  };
}

declare global {
  interface Window {
    __INITIAL_DATA__?: {
      spaces?: any[];
      config?: ClientConfig;
    };
  }
}

export const DEFAULT_CONFIG: ClientConfig = {
  core: {
    max_content_length: 1500
  }
};
