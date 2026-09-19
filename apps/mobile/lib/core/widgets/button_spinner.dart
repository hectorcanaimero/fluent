import 'package:flutter/material.dart';

/// Indicador chico para el botón que disparó una acción (empezar sesión,
/// aceptar un desafío, invitar): sin él, el botón solo se deshabilitaba y
/// no quedaba claro que algo estaba pasando. Toma el color del texto del
/// botón, así se ve igual sobre fondos claros y oscuros.
class ButtonSpinner extends StatelessWidget {
  const ButtonSpinner({super.key, this.size = 18});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        color: DefaultTextStyle.of(context).style.color,
      ),
    );
  }
}
