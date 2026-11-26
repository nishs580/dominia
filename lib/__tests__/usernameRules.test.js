const { usernameProblem, visibleProblem } = require('../usernameRules');

describe('usernameProblem', () => {
  test.each([
    ['Nick1', 'ok'],
    ['nick_1', 'symbol'],
    ['nick.r', 'symbol'],
    ['ni ck', 'symbol'],
    ['a', 'tooShort'],
    ['a'.repeat(21), 'tooLong'],
    ['', 'empty'],
    ['   ', 'empty'],
    [null, 'empty'],
  ])('%p -> %p', (input, expected) => {
    expect(usernameProblem(input)).toBe(expected);
  });

  test('trims surrounding spaces before checking', () => {
    expect(usernameProblem('  Nick1  ')).toBe('ok');
  });
});

describe('visibleProblem', () => {
  test('symbol shows immediately, even untouched', () => {
    expect(visibleProblem('a.b')).toBe('symbol');
  });
  test('length problems wait until touched', () => {
    expect(visibleProblem('a')).toBeNull();
    expect(visibleProblem('a', { touched: true })).toBe('tooShort');
  });
  test('empty never shows an error', () => {
    expect(visibleProblem('', { touched: true })).toBeNull();
  });
  test('valid name shows nothing', () => {
    expect(visibleProblem('Nick1', { touched: true })).toBeNull();
  });
});
