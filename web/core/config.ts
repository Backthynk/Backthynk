/**
 * Core application configuration
 */

/**
 * Space validation and constraints
 */
export const space = {
  /**
   * Maximum depth of space hierarchy (0 = root, 1 = first level, 2 = second level)
   */
  maxDepth: 2,

  /**
   * Name validation
   */
  name: {
    maxLength: 30,
    pattern: /^[a-zA-Z0-9]([a-zA-Z0-9\s\-_'.])*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
  },

  /**
   * Description validation
   */
  description: {
    maxLength: 280,
  },
} as const;

/**
 * Application metadata
 */
export const app = {
  /**
  * Current application version
  */
  
  version: '0.2.0',

  /**
   * External links
   */
  links: {
    discord: 'https://discord.gg/your-discord-link',
    github: 'https://github.com/your-repo',
    documentation: 'https://docs.your-app.com',
  },
} as const;

/**
 * Loading animation behavior
 */
export const loading = {
  /**
   * Minimum time to show the loading animation (in milliseconds)
   */
  minTime: 250,

  /**
   * Maximum time to wait before showing the app (in milliseconds)
   */
  maxTime: 1000,
} as const;

/**
 * Posts/timeline behavior
 */
export const posts = {
  /**
   * Number of posts to load per page/batch
   */
  postsPerPage: 20,
} as const;

/**
 * Cache configuration
 */
export const cache = {
  /**
   * Posts cache settings
   */
  posts: {
    /**
     * Maximum number of cached query results
     */
    maxSize: 50,

    /**
     * Time to live in milliseconds (5 minutes default)
     */
    ttl: 5 * 60 * 1000,

    /**
     * Enable debug logging
     */
    debug: false,

    /**
     * Smart refetch threshold (percentage of page size)
     * When list drops below this threshold after deletions/moves,
     * automatically fetch more posts if available
     */
    smartRefetchThreshold: 0.7, // 70%
  },
} as const;
