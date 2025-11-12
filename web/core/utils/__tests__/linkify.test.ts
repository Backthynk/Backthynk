/**
 * Tests for linkify utility functions
 */

import { describe, it, expect } from 'vitest';
import { linkifyText, extractUrls, isLinkOnlyText } from '../linkify';

describe('linkifyText', () => {
  describe('HTTP/HTTPS URLs', () => {
    it('should linkify basic HTTP URLs', () => {
      const text = 'Check out http://example.com';
      const result = linkifyText(text);
      expect(result).toBe('Check out <a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>');
    });

    it('should linkify basic HTTPS URLs', () => {
      const text = 'Check out https://example.com';
      const result = linkifyText(text);
      expect(result).toBe('Check out <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>');
    });

    it('should linkify URLs with paths', () => {
      const text = 'Visit https://example.com/path/to/page';
      const result = linkifyText(text);
      expect(result).toBe('Visit <a href="https://example.com/path/to/page" target="_blank" rel="noopener noreferrer">https://example.com/path/to/page</a>');
    });

    it('should linkify URLs with query parameters', () => {
      const text = 'Search https://example.com/search?q=test&page=1';
      const result = linkifyText(text);
      expect(result).toBe('Search <a href="https://example.com/search?q=test&page=1" target="_blank" rel="noopener noreferrer">https://example.com/search?q=test&page=1</a>');
    });

    it('should linkify URLs with fragments', () => {
      const text = 'See https://example.com/page#section';
      const result = linkifyText(text);
      expect(result).toBe('See <a href="https://example.com/page#section" target="_blank" rel="noopener noreferrer">https://example.com/page#section</a>');
    });

    it('should linkify multiple URLs in the same text', () => {
      const text = 'Visit https://example.com and https://test.com';
      const result = linkifyText(text);
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('<a href="https://test.com"');
    });
  });

  describe('Bare domain URLs', () => {
    it('should linkify www domains', () => {
      const text = 'Visit www.example.com for more';
      const result = linkifyText(text);
      expect(result).toBe('Visit <a href="http://www.example.com" target="_blank" rel="noopener noreferrer">www.example.com</a> for more');
    });

    it('should linkify www domains with paths', () => {
      const text = 'Check www.example.com/path';
      const result = linkifyText(text);
      expect(result).toContain('href="http://www.example.com/path"');
    });
  });

  describe('Email addresses', () => {
    it('should linkify basic email addresses', () => {
      const text = 'Contact me at user@example.com';
      const result = linkifyText(text);
      expect(result).toBe('Contact me at <a href="mailto:user@example.com">user@example.com</a>');
    });

    it('should linkify emails with dots and underscores', () => {
      const text = 'Email first.last_name@example.com';
      const result = linkifyText(text);
      expect(result).toContain('href="mailto:first.last_name@example.com"');
    });

    it('should not linkify emails that are part of URLs', () => {
      const text = 'Visit https://example.com/user@test';
      const result = linkifyText(text);
      // Should linkify as URL, not as email
      expect(result).toContain('href="https://example.com/user@test"');
      expect(result).not.toContain('mailto:');
    });
  });

  describe('Phone numbers', () => {
    it('should linkify phone numbers with country code', () => {
      const text = 'Call me at +1 234 567 8900';
      const result = linkifyText(text);
      expect(result).toContain('href="tel:+12345678900"');
      expect(result).toContain('+1 234 567 8900</a>');
    });

    it('should linkify phone numbers with dashes', () => {
      const text = 'Phone: 123-456-7890';
      const result = linkifyText(text);
      expect(result).toContain('href="tel:1234567890"');
    });

    it('should linkify phone numbers with dots', () => {
      const text = 'Call 123.456.7890';
      const result = linkifyText(text);
      expect(result).toContain('href="tel:1234567890"');
    });

    it('should linkify international phone numbers', () => {
      const text = 'France: +33 1 23 45 67 89';
      const result = linkifyText(text);
      expect(result).toContain('href="tel:+33123456789"');
    });

    it('should not linkify plain numbers without separators', () => {
      const text = 'The year 2025 is coming';
      const result = linkifyText(text);
      expect(result).toBe('The year 2025 is coming');
    });

    it('should not linkify phone numbers that are too short', () => {
      const text = 'Code: 123-456';
      const result = linkifyText(text);
      expect(result).toBe('Code: 123-456');
    });
  });

  describe('Exclude URLs option', () => {
    it('should exclude specified URLs from linkification', () => {
      const text = 'Visit https://example.com and https://test.com';
      const result = linkifyText(text, { excludeUrls: ['https://example.com'] });
      expect(result).not.toContain('<a href="https://example.com"');
      expect(result).toContain('<a href="https://test.com"');
    });

    it('should exclude bare domains when specified with protocol', () => {
      const text = 'Visit www.example.com';
      const result = linkifyText(text, { excludeUrls: ['http://www.example.com'] });
      expect(result).toBe('Visit www.example.com');
    });
  });

  describe('Mixed content', () => {
    it('should linkify multiple types in the same text', () => {
      const text = 'Visit https://example.com or email user@test.com or call +1-234-567-8900';
      const result = linkifyText(text);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('href="mailto:user@test.com"');
      expect(result).toContain('href="tel:+12345678900"');
    });

    it('should handle empty text', () => {
      expect(linkifyText('')).toBe('');
    });

    it('should handle text with no linkifiable content', () => {
      const text = 'Just plain text here';
      expect(linkifyText(text)).toBe('Just plain text here');
    });
  });
});

describe('extractUrls', () => {
  it('should extract HTTP URLs', () => {
    const text = 'Visit http://example.com and http://test.com';
    const urls = extractUrls(text);
    expect(urls).toEqual(['http://example.com', 'http://test.com']);
  });

  it('should extract HTTPS URLs', () => {
    const text = 'Visit https://example.com';
    const urls = extractUrls(text);
    expect(urls).toEqual(['https://example.com']);
  });

  it('should extract bare domains as HTTP URLs', () => {
    const text = 'Visit www.example.com';
    const urls = extractUrls(text);
    expect(urls).toEqual(['http://www.example.com']);
  });

  it('should extract multiple URLs of different types', () => {
    const text = 'Visit https://example.com and www.test.com';
    const urls = extractUrls(text);
    expect(urls).toHaveLength(2);
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('http://www.test.com');
  });

  it('should return empty array for text with no URLs', () => {
    const text = 'Just plain text';
    const urls = extractUrls(text);
    expect(urls).toEqual([]);
  });

  it('should return empty array for empty text', () => {
    const urls = extractUrls('');
    expect(urls).toEqual([]);
  });
});

describe('isLinkOnlyText', () => {
  it('should return true for text with only a URL', () => {
    expect(isLinkOnlyText('https://example.com')).toBe(true);
  });

  it('should return true for text with URL and whitespace', () => {
    expect(isLinkOnlyText('  https://example.com  ')).toBe(true);
  });

  it('should return false for text with URL and other content', () => {
    expect(isLinkOnlyText('Check out https://example.com')).toBe(false);
  });

  it('should return false for text with multiple URLs', () => {
    expect(isLinkOnlyText('https://example.com https://test.com')).toBe(false);
  });

  it('should return false for text with no URLs', () => {
    expect(isLinkOnlyText('Just text')).toBe(false);
  });

  it('should return false for empty text', () => {
    expect(isLinkOnlyText('')).toBe(false);
  });

  it('should return false for bare domain (since extracted URL has http://)', () => {
    // Bare domains get extracted as http://www.example.com, so they don't match the original text
    expect(isLinkOnlyText('www.example.com')).toBe(false);
  });
});
