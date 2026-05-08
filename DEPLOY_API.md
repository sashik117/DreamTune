# DreamTune API deploy

## Best option for the APK

Deploy the backend to Render or Railway and rebuild the Android app with a public HTTPS API URL.

The APK must not use `localhost:4000`, because on a phone `localhost` means the phone itself, not your PC.

## Render

1. Push this project to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml` and create:
   - `dreamtune-api`
   - `dreamtune-postgres`
4. Add secret environment variables in Render:
   - `PUBLIC_API_URL=https://YOUR_RENDER_SERVICE.onrender.com`
   - `SMTP_PASS=your_gmail_app_password`
   - `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`
   - `SPOTIFY_CLIENT_ID=...`
   - `SPOTIFY_CLIENT_SECRET=...`
5. Check:
   - `https://YOUR_RENDER_SERVICE.onrender.com/api/health`

## Rebuild Android APK for the public API

Create `.env.production` locally:

```env
VITE_API_URL=https://YOUR_RENDER_SERVICE.onrender.com
```

Then rebuild:

```bash
npm run android:debug
```

Or build release from Android:

```bash
npm run android:sync
cd android
gradlew.bat assembleRelease
```

## Music and cover storage

When `CLOUDINARY_URL` is set, uploaded covers/audio and YouTube-downloaded audio are stored in Cloudinary.
That keeps files alive after Render redeploys.

Without Cloudinary, files fall back to local folders:

- `public/uploads`
- `public/media`

Local folders are okay for development, but not reliable for production cloud hosting.
