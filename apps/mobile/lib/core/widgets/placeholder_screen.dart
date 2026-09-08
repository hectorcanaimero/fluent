import 'package:flutter/material.dart';

/// Pantalla temporal para rutas que todavía no tienen su tarea de
/// construcción (se reemplaza en el commit de la tarea correspondiente,
/// ver `docs/tasks/PR-06-app-movil.md`).
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ),
    );
  }
}
