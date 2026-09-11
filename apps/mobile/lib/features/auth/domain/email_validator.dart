/// Validación mínima de email para los formularios de auth (MEJ-06): algo
/// antes y después de una `@`, y un punto en el dominio. No pretende cubrir
/// el RFC; solo evitar ir al servidor con un valor que seguro está mal.
final RegExp _emailRegExp = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

bool isValidEmail(String value) => _emailRegExp.hasMatch(value.trim());
