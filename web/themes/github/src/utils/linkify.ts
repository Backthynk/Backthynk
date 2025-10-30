/**
 * Linkify utility - Automatically detect and convert URLs, emails, and phone numbers to HTML links
 */

export interface LinkifyOptions {
  /** URLs to exclude from linkification (e.g., URLs that appear in link previews) */
  excludeUrls?: string[];
}

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /(\+?\d{1,4}[\s-]?)?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9}/g;

/**
 * Convert URLs, emails, and phone numbers in text to clickable HTML links
 */
export function linkifyText(text: string, options: LinkifyOptions = {}): string {
  if (!text) return text;

  const { excludeUrls = [] } = options;
  let result = text;

  // Store original positions to avoid overlapping replacements
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  // Find all URLs
  let match: RegExpExecArray | null;
  const urlRegex = new RegExp(URL_REGEX.source, URL_REGEX.flags);
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    if (!excludeUrls.includes(url)) {
      replacements.push({
        start: match.index,
        end: match.index + url.length,
        replacement: `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
      });
    }
  }

  // Find all emails (that are not part of URLs)
  const emailRegex = new RegExp(EMAIL_REGEX.source, EMAIL_REGEX.flags);
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[0];
    // Check if this email is not inside a URL
    const isInUrl = replacements.some(
      (r) => match!.index >= r.start && match!.index + email.length <= r.end
    );
    if (!isInUrl) {
      replacements.push({
        start: match.index,
        end: match.index + email.length,
        replacement: `<a href="mailto:${email}">${email}</a>`,
      });
    }
  }

  // Find all phone numbers (basic detection, not perfect)
  const phoneRegex = new RegExp(PHONE_REGEX.source, PHONE_REGEX.flags);
  while ((match = phoneRegex.exec(text)) !== null) {
    const phone = match[0].trim();
    // Only linkify if it looks like a real phone number (has at least 7 digits)
    const digitCount = phone.replace(/\D/g, '').length;
    if (digitCount >= 7 && digitCount <= 15) {
      // Check if this phone is not inside a URL or email
      const isInOther = replacements.some(
        (r) => match!.index >= r.start && match!.index + phone.length <= r.end
      );
      if (!isInOther) {
        replacements.push({
          start: match.index,
          end: match.index + phone.length,
          replacement: `<a href="tel:${phone.replace(/\s/g, '')}">${phone}</a>`,
        });
      }
    }
  }

  // Sort replacements by start position (descending) to avoid index shifting
  replacements.sort((a, b) => b.start - a.start);

  // Apply replacements from end to start
  for (const { start, end, replacement } of replacements) {
    result = result.substring(0, start) + replacement + result.substring(end);
  }

  return result;
}

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Check if text contains only a single URL (and whitespace)
 */
export function isLinkOnlyText(text: string): boolean {
  if (!text) return false;
  const urls = extractUrls(text);
  return urls.length === 1 && text.trim() === urls[0];
}
