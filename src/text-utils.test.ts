import {describe, expect, test} from 'vitest';

import {stripCitations} from './text-utils';

describe('stripCitations', () => {
  test.each([
    {
      name: 'single citation marker',
      input: 'This is a test\uE200cite\uE202turn0search12\uE201 with citation',
      expected: 'This is a test with citation',
    },
    {
      name: 'citation with multiple turn segments',
      input: 'Some text\uE200cite\uE202turn0search12\uE202turn0news14\uE201 more text',
      expected: 'Some text more text',
    },
    {
      name: 'multiple separate citations',
      input:
        'First\uE200cite\uE202turn0search11\uE202turn0search2\uE201 and second\uE200cite\uE202turn0search0\uE202turn0search1\uE201 citation',
      expected: 'First and second citation',
    },
    {
      name: 'citation at the start of text',
      input: '\uE200cite\uE202turn0search12\uE201This is the beginning',
      expected: 'This is the beginning',
    },
    {
      name: 'citation at the end of text',
      input: 'This is the end\uE200cite\uE202turn0search12\uE201',
      expected: 'This is the end',
    },
    {
      name: 'text with no citations',
      input: 'This is plain text without any citations',
      expected: 'This is plain text without any citations',
    },
    {
      name: 'empty string',
      input: '',
      expected: '',
    },
    {
      name: 'citations with various turn numbers',
      input: 'Text\uE200cite\uE202turn1search99\uE202turn2news456\uE201 more',
      expected: 'Text more',
    },
    {
      name: 'citation with search keyword',
      input: 'Description\uE200cite\uE202turn0search1\uE202turn0search2\uE201 text',
      expected: 'Description text',
    },
    {
      name: 'consecutive citations',
      input:
        'Word\uE200cite\uE202turn0search1\uE201\uE200cite\uE202turn0search2\uE201end',
      expected: 'Wordend',
    },
    {
      name: 'real-world example with description',
      input:
        'Breaking Bad is an American crime drama\uE200cite\uE202turn0search12\uE201 created by Vince Gilligan',
      expected: 'Breaking Bad is an American crime drama created by Vince Gilligan',
    },
    {
      name: 'case insensitive for cite keyword',
      input: 'Text\uE200CITE\uE202turn0search12\uE201 more',
      expected: 'Text more',
    },
    {
      name: 'multiple word types (search, news, web, etc)',
      input: 'A\uE200cite\uE202turn0news5\uE201 B\uE200cite\uE202turn1web7\uE201 C',
      expected: 'A B C',
    },
  ])('should strip $name', ({input, expected}) =>
    expect(stripCitations(input)).toBe(expected)
  );
});
