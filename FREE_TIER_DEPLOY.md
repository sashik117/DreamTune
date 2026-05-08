# DreamTune zero-budget deploy

This setup keeps the app as close to 0 UAH as possible:

- Database: Supabase PostgreSQL
- Backend: Hugging Face Docker Space
- Storage: Cloudinary
- APK: Capacitor Android build with `VITE_API_URL`

## Reality check

No free provider honestly guarantees an always-awake backend forever.
Supabase Free includes PostgreSQL, but free projects can pause after inactivity.
Hugging Face Spaces can also sleep or cold-start.

The app now shows a friendly wake screen when the API is slow:

```text
DreamTune прокидається...
```

## 1. Supabase PostgreSQL

Create a free Supabase project and copy the **Session pooler** connection string.

Use it as:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

The backend automatically runs `db/schema.sql` on startup.

## 2. Cloudinary

Create a free Cloudinary account and copy:

```env
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

When this is set:

- covers go to Cloudinary with `f_auto,q_auto`
- uploaded audio goes to Cloudinary
- YouTube-downloaded audio goes to Cloudinary
- local temporary files are deleted after upload

## 3. Hugging Face Spaces Docker

Create a new Space:

- SDK: Docker
- Visibility: private or public
- Port: `7860`

Copy `HF_SPACE_README.md` content into the Space `README.md`, or keep the same YAML block.

Add secrets:

```env
DATABASE_URL=...
PUBLIC_API_URL=https://YOUR_USERNAME-YOUR_SPACE.hf.space
CLOUDINARY_URL=...
SUPPORT_EMAIL=dreamtuneteam@gmail.com
SMTP_USER=dreamtuneteam@gmail.com
SMTP_PASS=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Then push these files to the Space repository:

- `Dockerfile`
- `package.json`
- `package-lock.json`
- `server/`
- `db/`
- `public/`

Check:

```text
https://YOUR_USERNAME-YOUR_SPACE.hf.space/api/health
```

## 4. APK build for the public backend

Create `.env.production`:

```env
VITE_API_URL=https://YOUR_USERNAME-YOUR_SPACE.hf.space
```

Then rebuild:

```bash
npm run android:debug
```

For signed release:

```bash
npm run android:sync
cd android
gradlew.bat assembleRelease
```

The current signed APK flow produces:

```text
android/app/build/outputs/apk/release/DreamTune-release-signed.apk
```
