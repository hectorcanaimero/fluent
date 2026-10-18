import '../../../../l10n/gen/app_localizations.dart';

/// Una entrevista lista para empezar con un toque (F14.1.T1): id estable
/// para las keys de widget y tres textos localizados — título, qué se
/// practica, y el `offerText` que rellena el campo (nivel semi senior por
/// defecto, ajustable por la persona).
class StarterTemplate {
  const StarterTemplate({
    required this.id,
    required this.title,
    required this.description,
    required this.offerText,
  });

  final String id;
  final String Function(AppLocalizations l10n) title;
  final String Function(AppLocalizations l10n) description;
  final String Function(AppLocalizations l10n) offerText;
}

final starterTemplates = <StarterTemplate>[
  StarterTemplate(
    id: 'backend',
    title: (l10n) => l10n.interviewStarterBackendTitle,
    description: (l10n) => l10n.interviewStarterBackendDescription,
    offerText: (l10n) => l10n.interviewStarterBackendOfferText,
  ),
  StarterTemplate(
    id: 'frontend',
    title: (l10n) => l10n.interviewStarterFrontendTitle,
    description: (l10n) => l10n.interviewStarterFrontendDescription,
    offerText: (l10n) => l10n.interviewStarterFrontendOfferText,
  ),
  StarterTemplate(
    id: 'data',
    title: (l10n) => l10n.interviewStarterDataTitle,
    description: (l10n) => l10n.interviewStarterDataDescription,
    offerText: (l10n) => l10n.interviewStarterDataOfferText,
  ),
  StarterTemplate(
    id: 'product',
    title: (l10n) => l10n.interviewStarterProductTitle,
    description: (l10n) => l10n.interviewStarterProductDescription,
    offerText: (l10n) => l10n.interviewStarterProductOfferText,
  ),
  StarterTemplate(
    id: 'design',
    title: (l10n) => l10n.interviewStarterDesignTitle,
    description: (l10n) => l10n.interviewStarterDesignDescription,
    offerText: (l10n) => l10n.interviewStarterDesignOfferText,
  ),
  StarterTemplate(
    id: 'support',
    title: (l10n) => l10n.interviewStarterSupportTitle,
    description: (l10n) => l10n.interviewStarterSupportDescription,
    offerText: (l10n) => l10n.interviewStarterSupportOfferText,
  ),
];
