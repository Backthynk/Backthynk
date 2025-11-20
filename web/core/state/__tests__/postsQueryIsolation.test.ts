/**
 * Comprehensive tests for query-scoped posts state isolation
 *
 * These tests ensure that posts from different queries (different spaces,
 * recursive vs flat views, and future filters) don't cross-contaminate.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  type PostsQuery,
  generateQueryKey,
  getPostsForQuery,
  setPostsForQuery,
  resetPostsForQuery,
  appendPostsToQuery,
  getOffsetForQuery,
  setOffsetForQuery,
  isLoadingQuery,
  setLoadingForQuery,
  postsByQuery,
  loadingByQuery,
  offsetByQuery,
} from '../posts';
import { createMockPost, resetFactoryCounters } from '../../__tests__/factories';

describe('Posts Query Isolation', () => {
  beforeEach(() => {
    // Reset all query-scoped state
    postsByQuery.value = new Map();
    loadingByQuery.value = new Map();
    offsetByQuery.value = new Map();
    resetFactoryCounters();
  });

  describe('Query key generation', () => {
    it('should generate unique keys for different spaces', () => {
      const query1: PostsQuery = { spaceId: 1, recursive: false };
      const query2: PostsQuery = { spaceId: 2, recursive: false };

      expect(generateQueryKey(query1)).not.toBe(generateQueryKey(query2));
      expect(generateQueryKey(query1)).toBe('1:flat');
      expect(generateQueryKey(query2)).toBe('2:flat');
    });

    it('should generate unique keys for recursive vs flat', () => {
      const queryFlat: PostsQuery = { spaceId: 1, recursive: false };
      const queryRecursive: PostsQuery = { spaceId: 1, recursive: true };

      expect(generateQueryKey(queryFlat)).not.toBe(generateQueryKey(queryRecursive));
      expect(generateQueryKey(queryFlat)).toBe('1:flat');
      expect(generateQueryKey(queryRecursive)).toBe('1:rec');
    });

    it('should generate unique keys for All Spaces view', () => {
      const queryNull: PostsQuery = { spaceId: null, recursive: false };
      const querySpace: PostsQuery = { spaceId: 1, recursive: false };

      expect(generateQueryKey(queryNull)).not.toBe(generateQueryKey(querySpace));
      expect(generateQueryKey(queryNull)).toBe('all:flat');
    });
  });

  describe('Posts isolation between different spaces', () => {
    it('should keep posts separate for different spaces', () => {
      const space1Query: PostsQuery = { spaceId: 1, recursive: false };
      const space2Query: PostsQuery = { spaceId: 2, recursive: false };

      const space1Posts = [
        createMockPost({ id: 1, space_id: 1, content: 'Space 1 Post' }),
      ];
      const space2Posts = [
        createMockPost({ id: 2, space_id: 2, content: 'Space 2 Post' }),
      ];

      setPostsForQuery(space1Query, space1Posts);
      setPostsForQuery(space2Query, space2Posts);

      expect(getPostsForQuery(space1Query)).toEqual(space1Posts);
      expect(getPostsForQuery(space2Query)).toEqual(space2Posts);
      expect(getPostsForQuery(space1Query)).not.toEqual(space2Posts);
    });

    it('should not show space 1 posts when viewing space 2', () => {
      const space1Query: PostsQuery = { spaceId: 1, recursive: false };
      const space2Query: PostsQuery = { spaceId: 2, recursive: false };

      // Load posts for space 1
      const space1Posts = [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 1 }),
      ];
      setPostsForQuery(space1Query, space1Posts);

      // Space 2 should be empty (not contaminated by space 1)
      expect(getPostsForQuery(space2Query)).toEqual([]);
      expect(getPostsForQuery(space2Query).length).toBe(0);
    });

    it('should maintain separate offsets for different spaces', () => {
      const space1Query: PostsQuery = { spaceId: 1, recursive: false };
      const space2Query: PostsQuery = { spaceId: 2, recursive: false };

      setOffsetForQuery(space1Query, 20);
      setOffsetForQuery(space2Query, 10);

      expect(getOffsetForQuery(space1Query)).toBe(20);
      expect(getOffsetForQuery(space2Query)).toBe(10);
    });
  });

  describe('Posts isolation between recursive and flat views', () => {
    it('should keep recursive and flat views separate', () => {
      const flatQuery: PostsQuery = { spaceId: 1, recursive: false };
      const recursiveQuery: PostsQuery = { spaceId: 1, recursive: true };

      const flatPosts = [createMockPost({ id: 1, space_id: 1 })];
      const recursivePosts = [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 2 }), // Child space post
      ];

      setPostsForQuery(flatQuery, flatPosts);
      setPostsForQuery(recursiveQuery, recursivePosts);

      expect(getPostsForQuery(flatQuery)).toHaveLength(1);
      expect(getPostsForQuery(recursiveQuery)).toHaveLength(2);
    });

    it('should not show recursive posts in flat view', () => {
      const flatQuery: PostsQuery = { spaceId: 1, recursive: false };
      const recursiveQuery: PostsQuery = { spaceId: 1, recursive: true };

      // Load posts for recursive view (includes child posts)
      const recursivePosts = [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 2 }), // Child post
        createMockPost({ id: 3, space_id: 2 }), // Child post
      ];
      setPostsForQuery(recursiveQuery, recursivePosts);

      // Flat view should be empty (not contaminated by recursive view)
      expect(getPostsForQuery(flatQuery)).toEqual([]);
    });

    it('should maintain separate loading states', () => {
      const flatQuery: PostsQuery = { spaceId: 1, recursive: false };
      const recursiveQuery: PostsQuery = { spaceId: 1, recursive: true };

      setLoadingForQuery(flatQuery, true);
      setLoadingForQuery(recursiveQuery, false);

      expect(isLoadingQuery(flatQuery)).toBe(true);
      expect(isLoadingQuery(recursiveQuery)).toBe(false);
    });
  });

  describe('All Spaces view isolation', () => {
    it('should keep All Spaces view separate from specific spaces', () => {
      const allSpacesQuery: PostsQuery = { spaceId: null, recursive: false };
      const space1Query: PostsQuery = { spaceId: 1, recursive: false };

      const allSpacesPosts = [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 2 }),
        createMockPost({ id: 3, space_id: 3 }),
      ];
      const space1Posts = [createMockPost({ id: 1, space_id: 1 })];

      setPostsForQuery(allSpacesQuery, allSpacesPosts);
      setPostsForQuery(space1Query, space1Posts);

      expect(getPostsForQuery(allSpacesQuery)).toHaveLength(3);
      expect(getPostsForQuery(space1Query)).toHaveLength(1);
    });

    it('should not contaminate specific space when viewing All Spaces', () => {
      const allSpacesQuery: PostsQuery = { spaceId: null, recursive: false };
      const space1Query: PostsQuery = { spaceId: 1, recursive: false };

      // Load All Spaces first
      const allSpacesPosts = [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 2 }),
      ];
      setPostsForQuery(allSpacesQuery, allSpacesPosts);

      // Space 1 should still be empty
      expect(getPostsForQuery(space1Query)).toEqual([]);
    });
  });

  describe('Complex multi-query scenarios', () => {
    it('should handle multiple spaces with different recursive modes simultaneously', () => {
      const queries: PostsQuery[] = [
        { spaceId: 1, recursive: false },
        { spaceId: 1, recursive: true },
        { spaceId: 2, recursive: false },
        { spaceId: 2, recursive: true },
        { spaceId: null, recursive: false },
      ];

      // Set unique posts for each query
      queries.forEach((query, index) => {
        const posts = [createMockPost({ id: index + 1, space_id: query.spaceId || 0 })];
        setPostsForQuery(query, posts);
      });

      // Verify each query has its own posts
      queries.forEach((query, index) => {
        const posts = getPostsForQuery(query);
        expect(posts).toHaveLength(1);
        expect(posts[0].id).toBe(index + 1);
      });
    });

    it('should handle nested spaces without cross-contamination', () => {
      // Hierarchy: Space 1 -> Space 2 -> Space 3
      const space1Flat: PostsQuery = { spaceId: 1, recursive: false };
      const space1Rec: PostsQuery = { spaceId: 1, recursive: true };
      const space2Flat: PostsQuery = { spaceId: 2, recursive: false };
      const space2Rec: PostsQuery = { spaceId: 2, recursive: true };
      const space3Flat: PostsQuery = { spaceId: 3, recursive: false };

      setPostsForQuery(space1Flat, [createMockPost({ id: 1, space_id: 1 })]);
      setPostsForQuery(space1Rec, [
        createMockPost({ id: 1, space_id: 1 }),
        createMockPost({ id: 2, space_id: 2 }),
        createMockPost({ id: 3, space_id: 3 }),
      ]);
      setPostsForQuery(space2Flat, [createMockPost({ id: 2, space_id: 2 })]);
      setPostsForQuery(space2Rec, [
        createMockPost({ id: 2, space_id: 2 }),
        createMockPost({ id: 3, space_id: 3 }),
      ]);
      setPostsForQuery(space3Flat, [createMockPost({ id: 3, space_id: 3 })]);

      // Verify counts
      expect(getPostsForQuery(space1Flat)).toHaveLength(1);
      expect(getPostsForQuery(space1Rec)).toHaveLength(3);
      expect(getPostsForQuery(space2Flat)).toHaveLength(1);
      expect(getPostsForQuery(space2Rec)).toHaveLength(2);
      expect(getPostsForQuery(space3Flat)).toHaveLength(1);
    });
  });

  describe('Append and reset operations', () => {
    it('should append posts to correct query without affecting others', () => {
      const query1: PostsQuery = { spaceId: 1, recursive: false };
      const query2: PostsQuery = { spaceId: 2, recursive: false };

      setPostsForQuery(query1, [createMockPost({ id: 1 })]);
      setPostsForQuery(query2, [createMockPost({ id: 2 })]);

      appendPostsToQuery(query1, [createMockPost({ id: 3 })]);

      expect(getPostsForQuery(query1)).toHaveLength(2);
      expect(getPostsForQuery(query2)).toHaveLength(1);
    });

    it('should reset query without affecting others', () => {
      const query1: PostsQuery = { spaceId: 1, recursive: false };
      const query2: PostsQuery = { spaceId: 2, recursive: false };

      setPostsForQuery(query1, [createMockPost({ id: 1 })]);
      setPostsForQuery(query2, [createMockPost({ id: 2 })]);
      setOffsetForQuery(query1, 10);
      setOffsetForQuery(query2, 20);

      resetPostsForQuery(query1);

      expect(getPostsForQuery(query1)).toEqual([]);
      expect(getOffsetForQuery(query1)).toBe(0);
      expect(getPostsForQuery(query2)).toHaveLength(1);
      expect(getOffsetForQuery(query2)).toBe(20);
    });

    it('should update offset when appending posts', () => {
      const query: PostsQuery = { spaceId: 1, recursive: false };

      setPostsForQuery(query, [createMockPost({ id: 1 })]);
      expect(getOffsetForQuery(query)).toBe(0);

      appendPostsToQuery(query, [createMockPost({ id: 2 }), createMockPost({ id: 3 })]);
      expect(getOffsetForQuery(query)).toBe(2);
      expect(getPostsForQuery(query)).toHaveLength(3);
    });
  });

  describe('Edge cases', () => {
    it('should handle querying non-existent query (returns empty)', () => {
      const query: PostsQuery = { spaceId: 999, recursive: false };

      expect(getPostsForQuery(query)).toEqual([]);
      expect(getOffsetForQuery(query)).toBe(0);
      expect(isLoadingQuery(query)).toBe(false);
    });

    it('should handle undefined spaceId as different from null', () => {
      const queryUndefined: PostsQuery = { spaceId: undefined as any, recursive: false };
      const queryNull: PostsQuery = { spaceId: null, recursive: false };

      setPostsForQuery(queryNull, [createMockPost({ id: 1 })]);

      // undefined should behave like null for All Spaces
      expect(generateQueryKey(queryUndefined)).toBe(generateQueryKey(queryNull));
    });

    it('should handle exactly postsPerPage posts without contamination', () => {
      const query1: PostsQuery = { spaceId: 1, recursive: false };
      const query2: PostsQuery = { spaceId: 2, recursive: false };

      const postsPerPage = 20;
      const exactPosts = Array.from({ length: postsPerPage }, (_, i) =>
        createMockPost({ id: i + 1, space_id: 1 })
      );

      setPostsForQuery(query1, exactPosts);

      expect(getPostsForQuery(query1)).toHaveLength(postsPerPage);
      expect(getPostsForQuery(query2)).toHaveLength(0);
    });

    it('should handle rapid query switches without contamination', () => {
      const queries = [
        { spaceId: 1, recursive: false },
        { spaceId: 2, recursive: false },
        { spaceId: 1, recursive: true },
        { spaceId: 3, recursive: false },
        { spaceId: null, recursive: false },
      ] as PostsQuery[];

      // Rapidly switch between queries
      queries.forEach((query, i) => {
        setPostsForQuery(query, [createMockPost({ id: i + 1 })]);
      });

      // Each should have exactly 1 post
      queries.forEach((query, i) => {
        const posts = getPostsForQuery(query);
        expect(posts).toHaveLength(1);
        expect(posts[0].id).toBe(i + 1);
      });
    });

    it('should handle empty posts array correctly', () => {
      const query: PostsQuery = { spaceId: 1, recursive: false };

      setPostsForQuery(query, []);
      expect(getPostsForQuery(query)).toEqual([]);

      appendPostsToQuery(query, []);
      expect(getPostsForQuery(query)).toEqual([]);
      expect(getOffsetForQuery(query)).toBe(0);
    });
  });

  describe('Pagination edge cases', () => {
    it('should handle offset at exact boundary', () => {
      const query: PostsQuery = { spaceId: 1, recursive: false };
      const postsPerPage = 20;

      // Load first page
      const firstPage = Array.from({ length: postsPerPage }, (_, i) =>
        createMockPost({ id: i + 1 })
      );
      setPostsForQuery(query, firstPage);
      setOffsetForQuery(query, postsPerPage);

      expect(getPostsForQuery(query)).toHaveLength(postsPerPage);
      expect(getOffsetForQuery(query)).toBe(postsPerPage);

      // Load second page
      const secondPage = Array.from({ length: postsPerPage }, (_, i) =>
        createMockPost({ id: postsPerPage + i + 1 })
      );
      appendPostsToQuery(query, secondPage);

      expect(getPostsForQuery(query)).toHaveLength(postsPerPage * 2);
      expect(getOffsetForQuery(query)).toBe(postsPerPage * 2);
    });

    it('should handle partial last page', () => {
      const query: PostsQuery = { spaceId: 1, recursive: false };
      const postsPerPage = 20;

      // Load full first page
      const firstPage = Array.from({ length: postsPerPage }, (_, i) =>
        createMockPost({ id: i + 1 })
      );
      setPostsForQuery(query, firstPage);
      setOffsetForQuery(query, postsPerPage);

      // Load partial last page (only 5 posts)
      const lastPage = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ id: postsPerPage + i + 1 })
      );
      appendPostsToQuery(query, lastPage);

      expect(getPostsForQuery(query)).toHaveLength(25);
      expect(getOffsetForQuery(query)).toBe(25);
    });

    it('should handle no more posts (empty response)', () => {
      const query: PostsQuery = { spaceId: 1, recursive: false };

      setPostsForQuery(query, [createMockPost({ id: 1 })]);
      setOffsetForQuery(query, 1);

      // Try to load more but get empty response
      appendPostsToQuery(query, []);

      expect(getPostsForQuery(query)).toHaveLength(1);
      expect(getOffsetForQuery(query)).toBe(1); // Offset unchanged when no posts added
    });
  });
});
