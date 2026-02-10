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
    {
      name: 'real citation from user bug report',
      input:
        'Some text \ue200cite\ue202turn0search3\ue202turn0search0\ue202turn0search1\ue201 end',
      expected: 'Some text  end',
    },
    {
      name: 'Black Panther citation from actual output',
      input:
        '\u1f406\u0020\u0053\u0069\u006e\u0067\u006c\u0065\u002d\u0066\u0069\u006c\u0065\u0020\u0072\u0065\u006c\u0065\u0061\u0073\u0065\u0020\u2014\u0020\u0049\u004d\u0041\u0058\u0020\u0031\u0030\u0038\u0030\u0070\u0020\u0042\u006c\u0075\u0052\u0061\u0079\u0020\u0072\u0069\u0070\u0020\u0028\u0078\u0032\u0036\u0034\u002c\u0020\u0044\u006f\u006c\u0062\u0079\u0020\u0044\u0069\u0067\u0069\u0074\u0061\u006c\u0020\u0037\u002e\u0031\u0029\u0020\u006f\u0066\u0020\u004d\u0061\u0072\u0076\u0065\u006c\u0020\u0053\u0074\u0075\u0064\u0069\u006f\u0073\u0027\u0020\u0042\u006c\u0061\u0063\u006b\u0020\u0050\u0061\u006e\u0074\u0068\u0065\u0072\u0020\u0028\u0032\u0030\u0031\u0038\u0029\u002e\u0020\ue200\u0063\u0069\u0074\u0065\ue202\u0074\u0075\u0072\u006e\u0030\u0073\u0065\u0061\u0072\u0063\u0068\u0031\u0032\ue202\u0074\u0075\u0072\u006e\u0030\u0073\u0065\u0061\u0072\u0063\u0068\u0030\ue201',
      expected:
        '\u1f406\u0020\u0053\u0069\u006e\u0067\u006c\u0065\u002d\u0066\u0069\u006c\u0065\u0020\u0072\u0065\u006c\u0065\u0061\u0073\u0065\u0020\u2014\u0020\u0049\u004d\u0041\u0058\u0020\u0031\u0030\u0038\u0030\u0070\u0020\u0042\u006c\u0075\u0052\u0061\u0079\u0020\u0072\u0069\u0070\u0020\u0028\u0078\u0032\u0036\u0034\u002c\u0020\u0044\u006f\u006c\u0062\u0079\u0020\u0044\u0069\u0067\u0069\u0074\u0061\u006c\u0020\u0037\u002e\u0031\u0029\u0020\u006f\u0066\u0020\u004d\u0061\u0072\u0076\u0065\u006c\u0020\u0053\u0074\u0075\u0064\u0069\u006f\u0073\u0027\u0020\u0042\u006c\u0061\u0063\u006b\u0020\u0050\u0061\u006e\u0074\u0068\u0065\u0072\u0020\u0028\u0032\u0030\u0031\u0038\u0029\u002e\u0020',
    },
  ])('should strip $name', ({input, expected}) =>
    expect(stripCitations(input)).toBe(expected)
  );
});
