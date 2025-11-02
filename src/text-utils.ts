/**
 * Strips OpenAI citation markers from text.
 *
 * OpenAI API responses often include citation markers wrapped in private use Unicode characters.
 * The format is:
 * - \uE200 (start marker)
 * - cite
 * - \uE202 (separator) + turn{digits} + word + {digits}, repeated one or more times
 * - \uE201 (end marker)
 *
 * Examples:
 * - \uE200cite\uE202turn0search12\uE201
 * - \uE200cite\uE202turn0search12\uE202turn0news14\uE201
 *
 * @param text - The text containing citation markers
 * @returns The text with all citation markers removed
 *
 * @example
 * stripCitations('This is a text\uE200cite\uE202turn0search12\uE201 with citations')
 * // Returns: 'This is a text with citations'
 */
export function stripCitations(text: string): string {
  // Pattern matches:
  // - \uE200 (start delimiter)
  // - cite (literal)
  // - one or more groups of: \uE202 + turn + digits + letters + digits
  // - \uE201 (end delimiter)
  return text.replace(/\uE200cite(?:\uE202turn\d+[a-z]+\d+)+\uE201/gi, '');
}
