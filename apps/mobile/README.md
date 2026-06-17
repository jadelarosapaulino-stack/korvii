# Ruta Segura Mobile

App Flutter ciudadana para Ruta Segura RD.

## Recursos incluidos

- Registro, activacion, login y recuperacion de cuenta ciudadana.
- Perfil ciudadano y motociclista.
- Reportes ciudadanos con foto, GPS, provincia, municipio y direccion.
- Mapa de riesgo con reportes cercanos.
- Alertas cercanas segun ubicacion del usuario.
- Educacion vial y progreso.
- Modo emergencia con llamada al 911 y registro silencioso de la accion.
- Cliente API compatible con el backend NestJS existente.

## Configuracion inicial

Instala Flutter y genera los proyectos nativos:

```bash
cd apps/mobile
flutter create .
flutter pub get
```

Por defecto la app apunta al API remoto de Railway:

```text
https://korvii-api-prod.up.railway.app/api
```

Para apuntar al API local durante desarrollo:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

En dispositivo fisico usa la IP de tu equipo en la red local, por ejemplo:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000/api
```

## Permisos nativos pendientes despues de `flutter create`

Android: agregar permisos de ubicacion, camara e internet en `android/app/src/main/AndroidManifest.xml`.

iOS: agregar descripciones de ubicacion y camara en `ios/Runner/Info.plist`.
