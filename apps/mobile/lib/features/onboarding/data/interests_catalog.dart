/// Copia local del catálogo de intereses, usada solo como red de seguridad
/// si `GET /me` devolviera `interestsCatalog` vacío. Mismos 24 ids, en el
/// mismo orden, que `apps/api/src/content/interests.json`
/// (`INTERESTS_CATALOG_IDS` de `ProfilesService.getMe`, SPEC-02 §4.1).
const List<String> kFallbackInterests = [
  'technology',
  'videogames',
  'movies-series',
  'music',
  'sports',
  'football',
  'travel',
  'cooking',
  'health-fitness',
  'science',
  'space',
  'business-entrepreneurship',
  'personal-finance',
  'artificial-intelligence',
  'cars-motor',
  'fashion',
  'photography',
  'art-design',
  'books-literature',
  'history',
  'nature-animals',
  'environment',
  'education-career',
  'family-relationships',
];
