import { apiRequest } from './client';

export interface Post {
  id: number;
  space_id: number;
  content: string;
  created: number;
  files?: PostFile[];
  link_previews?: LinkPreview[];
  attachments?: PostFile[]; // Backend sometimes uses 'attachments' instead of 'files'
}

export interface PostFile {
  id: number;
  filename: string;
  file_path: string;  // Backend returns file_path
  file_size: number;  // Backend returns file_size
  file_type: string;  // Backend returns file_type (mime type)
  created: number;
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
  spaceId: number | null,
  limit = 50,
  offset = 0,
  withMeta = false,
  recursive = false
): Promise<PostsResponse> {
  try {
    // Use spaceId 0 for fetching all posts
    const id = spaceId === null ? 0 : spaceId;
    const response = await apiRequest<PostsResponse | Post[]>(`/spaces/${id}/posts`, {
      params: {
        limit,
        offset,
        with_meta: withMeta,
        recursive,
      },
    });

    // Handle both response formats
    if (!response) {
      return { posts: [], has_more: false };
    }

    // If withMeta=true, backend returns { posts: [...], has_more: ... }
    // If withMeta=false, backend returns just the array [...]
    if (Array.isArray(response)) {
      return { posts: response, has_more: response.length >= limit };
    }

    return response;
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
