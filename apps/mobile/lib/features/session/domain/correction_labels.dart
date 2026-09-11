import '../../../l10n/gen/app_localizations.dart';

/// MEJ-11: traduce la categoría cruda de una corrección (`Correction.category`,
/// catálogo fijo de `apps/api/src/llm/schemas.ts` `CATEGORIES`) a la etiqueta
/// localizada. Toda categoría nueva agrega su clave `correctionCategoryX` en
/// `app_es.arb` y `app_pt.arb` en el mismo commit.
String correctionCategoryLabel(AppLocalizations l10n, String category) {
  return switch (category) {
    'past_simple' => l10n.correctionCategoryPastSimple,
    'present_perfect' => l10n.correctionCategoryPresentPerfect,
    'articles' => l10n.correctionCategoryArticles,
    'prepositions' => l10n.correctionCategoryPrepositions,
    'word_order' => l10n.correctionCategoryWordOrder,
    'subject_verb' => l10n.correctionCategorySubjectVerb,
    'plurals' => l10n.correctionCategoryPlurals,
    'vocabulary' => l10n.correctionCategoryVocabulary,
    'pronunciation_hint' => l10n.correctionCategoryPronunciationHint,
    'false_friend' => l10n.correctionCategoryFalseFriend,
    'phrasal_verb' => l10n.correctionCategoryPhrasalVerb,
    'conditional' => l10n.correctionCategoryConditional,
    'modal' => l10n.correctionCategoryModal,
    'other' => l10n.correctionCategoryOther,
    _ => category,
  };
}
