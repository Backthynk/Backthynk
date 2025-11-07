/**
 * Test Factories
 * Generate dummy data for testing
 */

import type { Post, PostFile, LinkPreview } from '../api/posts';
import type { Space } from '../api/spaces';
import type { ActivityData, ActivityDay } from '../api/activity';
import type { SpaceStats } from '../api/spaces';

let postIdCounter = 1;
let spaceIdCounter = 1;
let fileIdCounter = 1;

/**
 * Reset all ID counters (useful between tests)
 */
export function resetFactoryCounters() {
  postIdCounter = 1;
  spaceIdCounter = 1;
  fileIdCounter = 1;
}

/**
 * Create a mock Post
 */
export function createMockPost(overrides?: Partial<Post>): Post {
  const id = overrides?.id ?? postIdCounter++;
  const spaceId = overrides?.space_id ?? 1;
  const created = overrides?.created ?? Math.floor(Date.now() / 1000);

  return {
    id,
    space_id: spaceId,
    content: overrides?.content ?? `Test post ${id}`,
    created,
    files: overrides?.files,
    link_previews: overrides?.link_previews,
    attachments: overrides?.attachments,
  };
}

/**
 * Create a mock Post with files (rich content)
 */
export function createMockPostWithFiles(fileCount = 1, overrides?: Partial<Post>): Post {
  const files: PostFile[] = [];
  for (let i = 0; i < fileCount; i++) {
    files.push({
      id: fileIdCounter++,
      filename: `file${i + 1}.png`,
      file_path: `/uploads/file${i + 1}.png`,
      file_size: 1024 * (i + 1),
      file_type: 'image/png',
      created: Math.floor(Date.now() / 1000),
    });
  }

  return createMockPost({
    ...overrides,
    files,
  });
}

/**
 * Create a mock Post with link previews (rich content)
 */
export function createMockPostWithLinks(linkCount = 1, overrides?: Partial<Post>): Post {
  const link_previews: LinkPreview[] = [];
  for (let i = 0; i < linkCount; i++) {
    link_previews.push({
      url: `https://example.com/page${i + 1}`,
      title: `Example Page ${i + 1}`,
      description: `Description for page ${i + 1}`,
      image_url: `https://example.com/image${i + 1}.jpg`,
      site_name: 'Example Site',
    });
  }

  return createMockPost({
    ...overrides,
    link_previews,
  });
}

/**
 * Create a mock Space
 */
export function createMockSpace(overrides?: Partial<Space>): Space {
  const id = overrides?.id ?? spaceIdCounter++;
  const name = overrides?.name ?? `Space ${id}`;

  return {
    id,
    name,
    description: overrides?.description ?? `Description for ${name}`,
    parent_id: overrides?.parent_id ?? null,
    post_count: overrides?.post_count ?? 0,
    recursive_post_count: overrides?.recursive_post_count ?? 0,
    created: overrides?.created ?? Math.floor(Date.now() / 1000),
  };
}

/**
 * Create a hierarchical tree of spaces
 * Example: createMockSpaceTree(3, 2) creates:
 * - Root space (id: 1)
 *   - Child 1 (id: 2)
 *   - Child 2 (id: 3)
 *   - Child 3 (id: 4)
 *     - Grandchild 1 (id: 5)
 *     - Grandchild 2 (id: 6)
 */
export function createMockSpaceTree(depth: number, childrenPerLevel: number): Space[] {
  const spaces: Space[] = [];

  function createChildren(parentId: number | null, currentDepth: number) {
    if (currentDepth >= depth) return;

    for (let i = 0; i < childrenPerLevel; i++) {
      const space = createMockSpace({
        parent_id: parentId,
        post_count: Math.floor(Math.random() * 10),
        recursive_post_count: Math.floor(Math.random() * 20),
      });
      spaces.push(space);

      // Recursively create children
      createChildren(space.id, currentDepth + 1);
    }
  }

  // Create root space
  const root = createMockSpace({
    parent_id: null,
    post_count: 5,
    recursive_post_count: 50,
  });
  spaces.push(root);

  // Create children
  createChildren(root.id, 1);

  return spaces;
}

/**
 * Create mock SpaceStats
 */
export function createMockSpaceStats(overrides?: Partial<SpaceStats>): SpaceStats {
  return {
    total_files: overrides?.total_files ?? 0,
    total_file_size: overrides?.total_file_size ?? 0,
    total_links: overrides?.total_links ?? 0,
    file_types: overrides?.file_types ?? {},
    top_domains: overrides?.top_domains ?? [],
  };
}

/**
 * Create mock ActivityData
 */
export function createMockActivityData(
  daysCount = 120,
  overrides?: Partial<ActivityData>
): ActivityData {
  const days: ActivityDay[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysCount);

  for (let i = 0; i < daysCount; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    days.push({
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 10),
    });
  }

  const totalPosts = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter(day => day.count > 0).length;
  const maxDayActivity = Math.max(...days.map(day => day.count));

  return {
    days,
    start_date: days[0].date,
    end_date: days[days.length - 1].date,
    stats: {
      total_posts: overrides?.stats?.total_posts ?? totalPosts,
      active_days: overrides?.stats?.active_days ?? activeDays,
      max_day_activity: overrides?.stats?.max_day_activity ?? maxDayActivity,
    },
    max_periods: overrides?.max_periods ?? 24,
  };
}

/**
 * Create a batch of posts for a specific space
 */
export function createMockPostsForSpace(
  spaceId: number,
  count: number,
  withRichContent = false
): Post[] {
  const posts: Post[] = [];
  for (let i = 0; i < count; i++) {
    if (withRichContent && i % 3 === 0) {
      // Every 3rd post has rich content
      posts.push(
        i % 2 === 0
          ? createMockPostWithFiles(1, { space_id: spaceId })
          : createMockPostWithLinks(1, { space_id: spaceId })
      );
    } else {
      posts.push(createMockPost({ space_id: spaceId }));
    }
  }
  return posts;
}
