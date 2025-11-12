import { apiRequest } from './client';

export interface Space {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  post_count: number;
  recursive_post_count: number;
  created: number;
  updated_at: number;
}

export interface CreateSpacePayload {
  name: string;
  description?: string;
  parent_id?: number | null;
}

export interface UpdateSpacePayload {
  name?: string;
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
  // The backend requires all fields, so we need to get the current space first
  // if any fields are missing from the payload
  let body: Record<string, any> = {};

  // If we have all required fields, use them directly
  if (payload.name !== undefined && payload.description !== undefined && payload.parent_id !== undefined) {
    body = {
      name: payload.name,
      description: payload.description,
      parent_id: payload.parent_id !== null ? parseInt(String(payload.parent_id)) : null,
    };
  } else {
    // Otherwise, fetch the current space and merge with the payload
    const currentSpace = await apiRequest<Space>(`/spaces/${spaceId}`);
    if (!currentSpace) {
      throw new Error('Space not found');
    }

    body = {
      name: payload.name !== undefined ? payload.name : currentSpace.name,
      description: payload.description !== undefined ? payload.description : currentSpace.description,
      parent_id: payload.parent_id !== undefined
        ? (payload.parent_id !== null ? parseInt(String(payload.parent_id)) : null)
        : currentSpace.parent_id,
    };
  }

  return apiRequest<Space>(`/spaces/${spaceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSpace(spaceId: number): Promise<void> {
  await apiRequest(`/spaces/${spaceId}`, {
    method: 'DELETE',
  });
}

export interface SpaceStats {
  space_id: number;
  recursive: boolean;
  file_count: number;
  total_size: number;
}

export async function fetchSpaceStats(
  spaceId: number,
  recursive: boolean = false
): Promise<SpaceStats | null> {
  return apiRequest<SpaceStats>(`/space-stats/${spaceId}`, {
    params: { recursive },
  });
}
