import 'package:flutter/material.dart';

/// Tokens de diseño extraídos de `docs/design/fluent.pen` (ver
/// `docs/design/README.md`). Único lugar donde se hardcodean estos valores;
/// el resto de la app consume [AppTheme] o [AppColors].
abstract final class AppColors {
  static const bg = Color(0xFFFAF8F4);
  static const surface = Color(0xFFFFFFFF);
  static const primary = Color(0xFF0E9C8C);
  static const primaryDark = Color(0xFF0B7D71);
  static const primarySoft = Color(0xFFDDF3EF);
  static const accent = Color(0xFFF0813B);
  static const accentSoft = Color(0xFFFDEBDC);

  /// Texto en color acento sobre `bg`/`surface` (5.1:1); `accent` puro no
  /// llega a AA como texto (2.5:1) y queda para rellenos e iconos (MEJ-01).
  static const accentText = Color(0xFFA9500F);
  static const gold = Color(0xFFF4B63F);
  static const goldSoft = Color(0xFFFDF1D6);

  /// Texto sobre `goldSoft` o `bg` (5.2:1); `gold` solo como relleno (MEJ-01).
  static const goldText = Color(0xFF8A5B00);
  static const textPrimary = Color(0xFF1C2024);
  static const textSecondary = Color(0xFF5C636C); // 5.7:1 sobre bg (MEJ-01)
  static const textMuted = Color(
    0xFF767D86,
  ); // 3.9:1 sobre bg: solo metadatos, nunca cuerpo (MEJ-01)
  static const border = Color(0xFFECE7DF);
  static const locked = Color(0xFFF1EEE9);
  static const success = Color(0xFF2FA36B);
  static const error = Color(0xFFE2574C);
}

abstract final class AppRadius {
  static const lg = 20.0;
  static const md = 14.0;
  static const pill = 999.0;
}

abstract final class AppSpacing {
  /// Padding horizontal estándar de pantalla.
  static const screenPad = 20.0;
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

const String _fontFamily = 'PlusJakartaSans';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: _fontFamily,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.accent,
        onSecondary: Colors.white,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
        error: AppColors.error,
        onError: Colors.white,
      ),
    );

    return base.copyWith(
      textTheme: base.textTheme
          .apply(
            fontFamily: _fontFamily,
            bodyColor: AppColors.textPrimary,
            displayColor: AppColors.textPrimary,
          )
          .copyWith(
            headlineLarge: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
            headlineMedium: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
            titleLarge: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
            titleMedium: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
            titleSmall: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
            bodyMedium: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
            bodySmall: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
            labelSmall: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          // `primaryDark`: blanco sobre `primary` da 3.4:1, insuficiente para
          // el texto de 16 px del botón; sobre `primaryDark` da 5.0:1 (MEJ-01).
          backgroundColor: AppColors.primaryDark,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.border),
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.error),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primarySoft,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: selected ? AppColors.primary : AppColors.textMuted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.primary : AppColors.textMuted,
          );
        }),
      ),
    );
  }
}
