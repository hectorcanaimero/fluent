import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../env.dart';

/// Cobro del plan Pro con RevenueCat (F4.2). La pantalla de plan depende de
/// esta interfaz; los tests usan un fake y no tocan el SDK.
abstract class BillingService {
  /// Vincula las compras con el usuario de InsForge (`app_user_id`).
  Future<void> logIn(String userId);

  /// Precio localizado del paquete `pro` (p. ej. «US$ 4,99»); `null` si no
  /// hay oferta disponible.
  Future<String?> proPrice();

  /// Abre la hoja de compra nativa del paquete `pro`. Si el usuario la
  /// cancela, vuelve sin error.
  Future<void> buyPro();

  Future<void> restore();
}

class RevenueCatBillingService implements BillingService {
  bool _configured = false;

  Future<void> _ensureConfigured() async {
    if (_configured) return;
    await Purchases.configure(PurchasesConfiguration(Env.revenuecatKey));
    _configured = true;
  }

  @override
  Future<void> logIn(String userId) async {
    await _ensureConfigured();
    await Purchases.logIn(userId);
  }

  Future<Package?> _proPackage() async {
    await _ensureConfigured();
    final offerings = await Purchases.getOfferings();
    return offerings.current?.getPackage('pro');
  }

  @override
  Future<String?> proPrice() async =>
      (await _proPackage())?.storeProduct.priceString;

  @override
  Future<void> buyPro() async {
    final package = await _proPackage();
    if (package == null) throw StateError('Paquete "pro" no disponible');
    try {
      await Purchases.purchase(PurchaseParams.package(package));
    } on PlatformException catch (e) {
      if (PurchasesErrorHelper.getErrorCode(e) ==
          PurchasesErrorCode.purchaseCancelledError) {
        return;
      }
      rethrow;
    }
  }

  @override
  Future<void> restore() async {
    await _ensureConfigured();
    await Purchases.restorePurchases();
  }
}
