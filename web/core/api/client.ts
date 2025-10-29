// Base API client configuration

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T | null> {
  const { params, ...fetchOptions } = options;

  // Build URL with query parameters
  let url = `/api${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorText || 'API request failed', response.status, response);
  }

  // Check if response has content
  const text = await response.text();
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return null;
  }
}
