import { INTERESTS } from '../../content/index.js';
import { isValidInterestsCatalog } from './interests-catalog.validator.js';

const validIds = INTERESTS.slice(0, 3).map((interest) => interest.id);

describe('isValidInterestsCatalog', () => {
  it('accepts 3 to 5 unique ids that exist in the catalog', () => {
    expect(isValidInterestsCatalog(validIds)).toBe(true);
    expect(isValidInterestsCatalog(INTERESTS.slice(0, 5).map((i) => i.id))).toBe(true);
  });

  it('rejects fewer than 3 ids', () => {
    expect(isValidInterestsCatalog(validIds.slice(0, 2))).toBe(false);
    expect(isValidInterestsCatalog([])).toBe(false);
  });

  it('rejects more than 5 ids', () => {
    expect(isValidInterestsCatalog(INTERESTS.slice(0, 6).map((i) => i.id))).toBe(false);
  });

  it('rejects ids that do not exist in the catalog', () => {
    expect(isValidInterestsCatalog(['not-a-real-id', 'also-fake', 'nope'])).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const [first, second] = validIds;
    expect(isValidInterestsCatalog([first, first, second])).toBe(false);
  });

  it('rejects non-array values', () => {
    expect(isValidInterestsCatalog('not-an-array')).toBe(false);
    expect(isValidInterestsCatalog(undefined)).toBe(false);
    expect(isValidInterestsCatalog(null)).toBe(false);
  });

  it('rejects arrays with non-string elements', () => {
    expect(isValidInterestsCatalog([1, 2, 3])).toBe(false);
  });
});
