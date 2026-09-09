import '../../../l10n/gen/app_localizations.dart';

/// Traduce el id de interés (clave estable que viaja a la API) a la
/// etiqueta localizada. Todo id nuevo agrega su clave `interestX` en
/// `app_es.arb` y `app_pt.arb` en el mismo commit.
String interestLabel(AppLocalizations l10n, String id) {
  return switch (id) {
    'technology' => l10n.interestTechnology,
    'videogames' => l10n.interestVideogames,
    'movies-series' => l10n.interestMoviesSeries,
    'music' => l10n.interestMusic,
    'sports' => l10n.interestSports,
    'football' => l10n.interestFootball,
    'travel' => l10n.interestTravel,
    'cooking' => l10n.interestCooking,
    'health-fitness' => l10n.interestHealthFitness,
    'science' => l10n.interestScience,
    'space' => l10n.interestSpace,
    'business-entrepreneurship' => l10n.interestBusinessEntrepreneurship,
    'personal-finance' => l10n.interestPersonalFinance,
    'artificial-intelligence' => l10n.interestArtificialIntelligence,
    'cars-motor' => l10n.interestCarsMotor,
    'fashion' => l10n.interestFashion,
    'photography' => l10n.interestPhotography,
    'art-design' => l10n.interestArtDesign,
    'books-literature' => l10n.interestBooksLiterature,
    'history' => l10n.interestHistory,
    'nature-animals' => l10n.interestNatureAnimals,
    'environment' => l10n.interestEnvironment,
    'education-career' => l10n.interestEducationCareer,
    'family-relationships' => l10n.interestFamilyRelationships,
    _ => id,
  };
}
