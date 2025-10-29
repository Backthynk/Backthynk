import { apiRequest } from './client';

export interface Post {
  id: number;
  space_id: number;
  content: string;
  created_at: number;
  updated_at: number;
  files?: PostFile[];
  link_previews?: LinkPreview[];
}

export interface PostFile {
  id: number;
  filename: string;
  size: number;
  mime_type: string;
  created_at: number;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
}

export interface PostsResponse {
  posts: Post[];
  has_more: boolean;
}

export interface CreatePostPayload {
  space_id: number;
  content: string;
  link_previews?: LinkPreview[];
  custom_timestamp?: number;
}

export async function fetchPosts(
  spaceId: number,
  limit = 50,
  offset = 0,
  withMeta = false,
  recursive = false
): Promise<PostsResponse> {
  try {
    const response = await apiRequest<PostsResponse>(`/spaces/${spaceId}/posts`, {
      params: {
        limit,
        offset,
        with_meta: withMeta,
        recursive,
      },
    });
    return response || { posts: [], has_more: false };
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return { posts: [], has_more: false };
  }
}

export async function createPost(payload: CreatePostPayload): Promise<Post | null> {
  return apiRequest<Post>('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deletePost(postId: number): Promise<void> {
  await apiRequest(`/posts/${postId}`, {
    method: 'DELETE',
  });
}

export async function movePost(postId: number, newSpaceId: number): Promise<Post | null> {
  return apiRequest<Post>(`/posts/${postId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ space_id: newSpaceId }),
  });
}

export async function uploadFile(postId: number, file: File): Promise<PostFile | null> {
  const formData = new FormData();
  formData.append('post_id', String(postId));
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    return await apiRequest<LinkPreview>('/link-preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  } catch (error) {
    console.error('Failed to fetch link preview:', error);
    return null;
  }
}
