import { levelFor } from './level.js';

describe('levelFor', () => {
  it.each([
    [0, 'Newcomer', 0, 500],
    [499, 'Newcomer', 0, 500],
    [500, 'Chatterbox', 500, 1500],
    [1499, 'Chatterbox', 500, 1500],
    [1500, 'Storyteller', 1500, 3500],
    [3499, 'Storyteller', 1500, 3500],
    [3500, 'Debater', 3500, 7000],
    [6999, 'Debater', 3500, 7000],
    [7000, 'Native-ish', 7000, null],
  ])('xp=%i -> %s (min=%i, next=%p)', (xp, name, min, next) => {
    expect(levelFor(xp)).toEqual({ name, min, next });
  });

  it('well above the last level still resolves to Native-ish with next=null', () => {
    expect(levelFor(50_000)).toEqual({ name: 'Native-ish', min: 7000, next: null });
  });

  it('rejects negative xp gracefully by falling back to the first level', () => {
    expect(levelFor(-10)).toEqual({ name: 'Newcomer', min: 0, next: 500 });
  });
});
