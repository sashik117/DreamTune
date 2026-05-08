---
title: DreamTune API
emoji: DreamTune
colorFrom: pink
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# DreamTune API

Docker Space for the DreamTune backend.

Healthcheck:

```text
/api/health
```

Required secrets:

- `DATABASE_URL`
- `PUBLIC_API_URL`
- `CLOUDINARY_URL`
- `SMTP_PASS`

Optional secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
