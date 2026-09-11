# flutter_local_notifications necesita estas reglas cuando R8/ProGuard está
# activo (ver su README): mantiene sus clases y las de GSON que usa para
# (de)serializar las notificaciones programadas.
-keep class com.dexterous.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepattributes Signature
-keepattributes *Annotation*
