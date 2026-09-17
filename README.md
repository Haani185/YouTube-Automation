# YouTube AI Manager

An auditable control center for AI-assisted YouTube production.

## Local setup

Requirements: Node.js 24+.

```powershell
cmd /c npm install
cmd /c npm run dev
```

Open `http://localhost:3000`. Local development data is stored in `data/control-center.sqlite` by default.

The Control Center includes channel and brand settings, project state transitions, immutable artifact revisions, approval records, durable single-claim jobs, rendering, publishing, analytics, and operational recovery controls. External providers are optional and credential-gated.

Topic generation runs locally in deterministic demo mode. To enable the optional OpenAI Responses API adapter, copy `.env.example` to `.env.local`, set `AI_PROVIDER=openai`, and provide `OPENAI_API_KEY`. Never commit that file.

The evidence workspace stores source provenance and a claim ledger. Research cannot advance while claims are unsupported, stale, source-free, or insufficiently supported for their risk level. Script drafts are generated only from claims marked supported and linked to recorded sources.

Approved scripts can be converted into timed scene storyboards and deterministic 1080p render manifests. Storyboard timing, contiguous ordering, visual routing, overlays, transitions, codecs, and caption strategy are validated before the project advances to asset generation.

The default media pipeline uses only free tools: local SVG scene visuals, API-key-free Edge neural speech, the built-in Windows offline voice as a fallback, and bundled FFmpeg rendering. Provider, license, provenance, checksum, MIME type, and zero cost are recorded. Set `FREE_TTS_VOICE` to another Edge voice if desired; no paid visual or voice API is required.

The bundled FFmpeg renderer combines the scene visuals, offline narration, and SRT captions into an H.264/AAC MP4. If Windows speech is unavailable, rendering remains functional with a silent local fallback. ffprobe verifies codec, resolution, duration, audio, and captions before the workflow enters QA review.

Final QA creates three branded thumbnail candidates, a title/description/chapter/tag package, disclosure recommendation, and a checksummed ZIP containing the video, captions, selected thumbnail, metadata, QA, and provenance records.

YouTube integration uses server-side OAuth with CSRF state, encrypted tokens, least-privilege upload and read-only analytics scopes, persistent resumable-session records, duplicate protection, and private-only uploads. Configure the four Google variables in `.env.local`, register the exact callback URL in Google Cloud, then connect from Channel settings. Connections created before analytics support must be reconnected once to grant the new read-only permissions.

Publishing defaults to `PUBLISH_PROVIDER=demo`, which supports the complete private-upload, thumbnail-selection, schedule, publish, reconcile, and analytics lifecycle without making an external change. Set `PUBLISH_PROVIDER=youtube` only when the channel is connected and you intend those controls to mutate the real YouTube video.

Analytics defaults to deterministic demo data (`ANALYTICS_PROVIDER=demo`). Each publish-ready project can capture 24-hour, 72-hour, 7-day, and 30-day snapshots and generate evidence-linked packaging, retention, and subscriber-conversion recommendations. Recommendations are proposals only and require an explicit approve or reject decision. Set `ANALYTICS_PROVIDER=youtube` only after connecting an uploaded video with YouTube Analytics access; live snapshots leave impressions and CTR unavailable because those metrics require a separate reporting surface.

The System page provides database integrity, workflow failure, provider readiness, and monthly-budget checks plus consistent local SQLite backups. Set `MONTHLY_BUDGET_USD` to control the warning and blocking thresholds. Machine-readable readiness is available from `GET /api/health`.

## Verification

```powershell
cmd /c npm test
cmd /c npm run typecheck
cmd /c npm run lint
cmd /c npm run build
```

See `DEVELOPMENT_PLAN.md` for architecture, delivery phases, quality gates, and product decisions.
