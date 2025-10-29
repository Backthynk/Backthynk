import { apiRequest } from './client';

export interface Space {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  post_count: number;
  created_at: number;
  updated_at: number;
  recursiveMode?: boolean; // Optional: tracks if viewing this space recursively
}

export interface CreateSpacePayload {
  name: string;
  description?: string;
  parent_id?: number | null;
}

export interface UpdateSpacePayload {
  name: string;
  description?: string;
  parent_id?: number | null;
}

export async function fetchSpaces(): Promise<Space[]> {
  const spaces = await apiRequest<Space[]>('/spaces');
  return spaces || [];
}

export async function createSpace(payload: CreateSpacePayload): Promise<Space | null> {
  return apiRequest<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      description: payload.description || '',
      parent_id: payload.parent_id ? parseInt(String(payload.parent_id)) : null,
    }),
  });
}

export async function updateSpace(
  spaceId: number,
  payload: UpdateSpacePayload
): Promise<Space | null> {
  return apiRequest<Space>(`/spaces/${spaceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name,
      description: payload.description || '',
      parent_id: payload.parent_id ? parseInt(String(payload.parent_id)) : null,
    }),
  });
}

export async function deleteSpace(spaceId: number): Promise<void> {
  await apiRequest(`/spaces/${spaceId}`, {
    method: 'DELETE',
  });
}
