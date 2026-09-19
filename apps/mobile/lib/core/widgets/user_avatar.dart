import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Avatar del usuario: la foto del login social si hay, y si no (o si no
/// carga) la inicial del nombre sobre primarySoft.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.size = 48,
  });

  final String name;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initial = Center(
      child: Text(
        name.isNotEmpty ? name.characters.first.toUpperCase() : '?',
        style: TextStyle(
          fontSize: size * 0.4,
          fontWeight: FontWeight.w700,
          color: AppColors.primaryDark,
        ),
      ),
    );
    final url = imageUrl;
    return ExcludeSemantics(
      child: ClipOval(
        child: SizedBox.square(
          dimension: size,
          child: ColoredBox(
            color: AppColors.primarySoft,
            child: url == null
                ? initial
                : Image.network(
                    url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => initial,
                  ),
          ),
        ),
      ),
    );
  }
}
