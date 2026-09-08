/// Copia local del catálogo de intereses, usada mientras `GET /me` no
/// devuelva `interestsCatalog` (SPEC-02 §4.1 lo agrega en PR-02/T2) o si la
/// respuesta llega vacía. Los primeros 8 coinciden con los chips del diseño
/// de Pen ("03 Onboarding · Interests"); el resto completa el catálogo de
/// 24 mencionado en docs/design/README.md.
const List<String> kFallbackInterests = [
  'travel',
  'business',
  'tech',
  'sports',
  'movies',
  'food',
  'daily_life',
  'news',
  'music',
  'gaming',
  'fitness',
  'books',
  'art',
  'science',
  'cooking',
  'photography',
  'fashion',
  'cars',
  'nature',
  'politics',
  'history',
  'health',
  'finance',
  'pets',
];
