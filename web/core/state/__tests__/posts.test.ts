/**
 * Tests for post state and helper functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {posts, resetPosts, appendPosts, postHasRichContent } from '../posts';
import { createMockPost, createMockPostWithFiles, createMockPostWithLinks, resetFactoryCounters } from '../../__tests__/factories';

describe('Post State', () => {
  beforeEach(() => {
    resetPosts();
    resetFactoryCounters();
  });

  describe('resetPosts', () => {
    it('should clear all posts', () => {
      posts.value = [createMockPost(), createMockPost()];
      expect(posts.value.length).toBe(2);

      resetPosts();
      expect(posts.value.length).toBe(0);
    });
  });

  describe('appendPosts', () => {
    it('should append new posts to existing posts', () => {
      const post1 = createMockPost();
      const post2 = createMockPost();
      const post3 = createMockPost();

      posts.value = [post1];
      appendPosts([post2, post3]);

      expect(posts.value.length).toBe(3);
      expect(posts.value).toEqual([post1, post2, post3]);
    });

    it('should handle empty array', () => {
      posts.value = [createMockPost()];
      appendPosts([]);

      expect(posts.value.length).toBe(1);
    });
  });

  describe('postHasRichContent', () => {
    it('should return false for text-only post', () => {
      const post = createMockPost({ content: 'Just text' });
      expect(postHasRichContent(post)).toBe(false);
    });

    it('should return true for post with files', () => {
      const post = createMockPostWithFiles(1);
      expect(postHasRichContent(post)).toBe(true);
    });

    it('should return true for post with multiple files', () => {
      const post = createMockPostWithFiles(3);
      expect(postHasRichContent(post)).toBe(true);
    });

    it('should return true for post with attachments', () => {
      const post = createMockPost({
        attachments: [
          {
            id: 1,
            filename: 'file.pdf',
            file_path: '/uploads/file.pdf',
            file_size: 1024,
            file_type: 'application/pdf',
            created: Date.now(),
          },
        ],
      });
      expect(postHasRichContent(post)).toBe(true);
    });

    it('should return true for post with link previews', () => {
      const post = createMockPostWithLinks(1);
      expect(postHasRichContent(post)).toBe(true);
    });

    it('should return true for post with multiple link previews', () => {
      const post = createMockPostWithLinks(3);
      expect(postHasRichContent(post)).toBe(true);
    });

    it('should return false for post with empty files array', () => {
      const post = createMockPost({ files: [] });
      expect(postHasRichContent(post)).toBe(false);
    });

    it('should return false for post with empty link_previews array', () => {
      const post = createMockPost({ link_previews: [] });
      expect(postHasRichContent(post)).toBe(false);
    });

    it('should return true for post with both files and link previews', () => {
      const post = createMockPostWithFiles(1);
      post.link_previews = [
        {
          url: 'https://example.com',
          title: 'Example',
        },
      ];
      expect(postHasRichContent(post)).toBe(true);
    });
  });
});
