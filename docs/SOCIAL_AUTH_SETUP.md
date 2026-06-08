# Korvi Social Auth Setup

## Backend

Set these variables in `apps/backend/.env`:

```env
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

`GOOGLE_CLIENT_ID` must be the Web client ID used as the audience for Google ID tokens.

## Flutter Android

Google Sign-In requires an Android OAuth client configured in Google Cloud with:

- Package name: `com.example.ruta_segura_mobile`
- SHA-1 and SHA-256 from the Android signing key

When running the app, pass the server client ID:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api --dart-define=GOOGLE_SERVER_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

For Facebook Login, replace the placeholder values in:

```text
apps/mobile/android/app/src/main/res/values/social_auth.xml
```

Required values:

- `facebook_app_id`
- `facebook_client_token`
- `fb_login_protocol_scheme` as `fb<facebook_app_id>`

Also register the Android package and key hashes in Meta for Developers.
