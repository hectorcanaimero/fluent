import '../../../l10n/gen/app_localizations.dart';

/// Traduce el id de interés (clave estable que viaja a la API) a la
/// etiqueta localizada. Todo id nuevo agrega su clave `interestX` en
/// `app_es.arb` y `app_pt.arb` en el mismo commit.
String interestLabel(AppLocalizations l10n, String id) {
  return switch (id) {
    'travel' => l10n.interestTravel,
    'business' => l10n.interestBusiness,
    'tech' => l10n.interestTech,
    'sports' => l10n.interestSports,
    'movies' => l10n.interestMovies,
    'food' => l10n.interestFood,
    'daily_life' => l10n.interestDailyLife,
    'news' => l10n.interestNews,
    'music' => l10n.interestMusic,
    'gaming' => l10n.interestGaming,
    'fitness' => l10n.interestFitness,
    'books' => l10n.interestBooks,
    'art' => l10n.interestArt,
    'science' => l10n.interestScience,
    'cooking' => l10n.interestCooking,
    'photography' => l10n.interestPhotography,
    'fashion' => l10n.interestFashion,
    'cars' => l10n.interestCars,
    'nature' => l10n.interestNature,
    'politics' => l10n.interestPolitics,
    'history' => l10n.interestHistory,
    'health' => l10n.interestHealth,
    'finance' => l10n.interestFinance,
    'pets' => l10n.interestPets,
    _ => id,
  };
}
