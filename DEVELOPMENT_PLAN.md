# YouTube AI Channel Manager — Senior Engineering Plan

## 1. Product objective

Build a reliable system that can take a configured channel from topic discovery to a publish-ready YouTube package, then later upload, schedule, measure, and improve future content.

The system must optimize for:

- factual accuracy and source traceability;
- repeatable video quality and channel consistency;
- safe human approval before costly or public actions;
- resumable jobs, idempotency, and failure recovery;
- provider portability and explicit cost tracking;
- compliance with YouTube policies and third-party asset licenses.

The first production milestone is **not full autonomy**. It is one end-to-end, human-reviewed pipeline that reliably produces:

- a final MP4;
- captions;
- three thumbnail candidates;
- title, description, chapters, tags, and disclosure recommendation;
- a complete audit trail linking claims and assets to sources/licenses.

## 2. Scope boundaries

### MVP scope

- One YouTube channel and one long-form format (16:9, 6–10 minutes).
- One language and one configured narrator voice.
- Manual topic approval, script approval, and publish approval.
- Research from approved web sources with citations.
- Structured script and storyboard generation.
- Still images, licensed stock clips, diagrams, text motion, narration, music, and captions.
- Deterministic FFmpeg-based rendering.
- Local/S3-compatible asset storage.
- Complete job history, retry controls, and cost ledger.
- Publish-ready export; YouTube upload added only after rendering/QA is stable.

### Explicitly deferred

- Multiple channels, organizations, roles, billing, or a public SaaS product.
- Fully autonomous public publishing.
- Shorts, multilingual variants, voice cloning, comment automation, and automatic A/B testing.
- Training/fine-tuning models.
- A general-purpose multi-agent chat framework.

## 3. Recommended architecture

Use a modular monolith first. Split services only when operational evidence justifies it.

### Application stack

- **Web dashboard:** Next.js + TypeScript + Tailwind + a stable component library.
- **API and orchestration:** FastAPI + Python, with typed Pydantic contracts.
- **Database:** PostgreSQL; Supabase is acceptable for managed Postgres/Auth/Storage.
- **Job queue:** Redis + Dramatiq/Celery for MVP. Consider Temporal only when workflows require long-lived, cross-service durability at greater scale.
- **Media pipeline:** FFmpeg/ffprobe plus Pillow/ImageMagick where needed.
- **Object storage:** S3-compatible storage (Supabase Storage locally/cloud initially).
- **LLM integration:** provider adapter with schema-constrained outputs; no business logic hidden in prompts.
- **Observability:** structured logs, OpenTelemetry-ready tracing, error tracking, and per-stage cost/latency metrics.
- **Deployment:** Docker Compose for development; one web service, one API, one worker, PostgreSQL, Redis, and object storage. Move to managed services after MVP validation.

### Why not make n8n the core

n8n can be added later for notifications and simple external integrations. The production state machine, retries, approvals, schemas, and tests should live in version-controlled application code. This avoids large opaque workflows becoming the system's source of truth.

### Logical component map

```text
Dashboard
   |
FastAPI control plane ---- PostgreSQL
   |                           |
Job queue ---------------- Audit/event log
   |
Workflow workers
   |-- research/topic
   |-- script/fact-check/storyboard
   |-- visual/voice/thumbnail/SEO
   |-- media render/QA
   |-- YouTube publisher/analytics (later)
   |
Object storage + external provider adapters
```

## 4. Workflow and state model

Each video is a durable production record. The state transition service is the only component allowed to change its primary state.

```text
DRAFT_IDEA
  -> TOPIC_REVIEW
  -> RESEARCHING
  -> RESEARCH_REVIEW
  -> SCRIPTING
  -> SCRIPT_REVIEW
  -> STORYBOARDING
  -> ASSET_GENERATION
  -> RENDERING
  -> QA_REVIEW
  -> READY_TO_PUBLISH
  -> PUBLISH_APPROVAL
  -> UPLOADING
  -> SCHEDULED | PUBLISHED
  -> ANALYZING
```

Any execution state may move to `FAILED_RETRYABLE`, `FAILED_BLOCKED`, or `CANCELLED`. Rework creates a new artifact revision and transitions to the appropriate prior stage; it never silently overwrites an approved artifact.

### Workflow invariants

- Every job has an idempotency key and bounded retry policy.
- Each external request records provider, model/version, request hash, latency, usage, estimated cost, and result status.
- Generated files are immutable and content-addressed where practical.
- Approved artifact versions are pinned as downstream inputs.
- Publishing requires a separate explicit approval token.
- A retry may not create duplicate uploads or duplicate billable assets.
- Failed partial renders and upload sessions are resumable.

## 5. Core data model

Start with these entities:

- `channels`: niche, audience, language, timezone, cadence, default duration, YouTube identifiers.
- `brand_profiles`: voice/tone, visual rules, colors, fonts, logo, intro/outro, prohibited patterns.
- `content_strategies`: pillars, target viewer problems, goals, exclusions, current revision.
- `video_projects`: working title, format, target duration, state, priority, schedule, active revisions.
- `topic_candidates`: evidence, scoring dimensions, score explanation, approval result.
- `research_items`: query, source URL, publisher, retrieved date, excerpt/notes, trust rating.
- `claims`: normalized claim, source links, support status, risk level, script references.
- `scripts` and `script_sections`: narration, hook, CTA, word count, revision, approval.
- `scenes`: order, target duration, narration slice, visual type, overlay, transition, claim references.
- `assets`: type, URI, source/provider, generation prompt, license/provenance, checksum, dimensions/duration.
- `voice_tracks`: voice/provider, pronunciation dictionary version, timing/alignment data.
- `renders`: render manifest, FFmpeg version/command hash, output URI, technical measurements.
- `thumbnail_candidates`: concept, asset URI, mobile-readability score, selection status.
- `seo_packages`: title variants, description, chapters, tags, hashtags, target intent.
- `qa_checks`: rule, severity, evidence, result, remediation, reviewer.
- `approvals`: stage, artifact revision, actor, timestamp, comment.
- `publish_jobs`: privacy, schedule, upload session, YouTube ID, retry/status data.
- `analytics_snapshots`: window, video/channel metrics, retrieval time.
- `recommendations`: evidence, confidence, proposed strategy change, approval state.
- `workflow_runs`, `step_runs`, `events`, and `cost_entries`: operational audit trail.

Use UUIDs, UTC timestamps, JSONB only for provider-specific payloads, and relational columns for fields used in filtering, constraints, or reporting.

## 6. Agent contracts

Each agent is a pure-ish service with a versioned input/output schema, prompt version, validator, and evaluation set.

### Strategy agent

- Input: channel/brand profile, goals, historical approved analytics.
- Output: content pillars, audience problems, cadence, format rules, exclusions, experiment backlog.
- Guardrail: analytics may suggest changes but cannot mutate strategy without approval.

### Research and topic agent

- Input: strategy, freshness window, approved source policy, recent topics/history.
- Output: 10–20 candidates, deduplication result, evidence packet, weighted score and uncertainty.
- Initial scoring: demand 25%, audience fit 20%, competition opportunity 15%, click potential 15%, evergreen value 10%, freshness 10%, business value 5%.
- Guardrail: scores must expose supporting evidence; invented trend data is rejected.

### Script agent

- Input: approved topic and research package, style guide, duration, keyword intent.
- Output: structured sections, narration, claim references, hook/CTA, estimated timing.
- Guardrail: factual sentences require claim IDs; unsupported claims fail validation.

### Fact-check agent

- Input: script claims and sources.
- Output: supported/partially supported/unsupported/stale, evidence, correction proposal, risk.
- Guardrail: high-risk claims need stronger sources and manual approval.

### Storyboard agent

- Input: approved script revision and production rules.
- Output: ordered scene JSON with narration offsets, duration, visual type, prompts, overlays, transitions, and asset requirements.
- Guardrail: total scene timing must reconcile with narration duration after TTS alignment.

### Visual and voice agents

- Input: approved scene/voice specifications and brand profile.
- Output: immutable assets plus provenance, license, technical metadata, and cost.
- Guardrail: no unlicensed scraping; no real-person likeness or voice cloning without recorded consent.

### Thumbnail and SEO agents

- Input: approved topic/script, brand profile, selected frames/assets, competitive observations.
- Output: three distinct thumbnail concepts and title variants, then a complete metadata package.
- Guardrail: no misleading claims; validate text safe area and mobile readability.

### QA agent

- Input: all pinned artifacts plus final media.
- Output: machine-readable pass/fail checks, severity, timestamps/evidence, remediation route.
- Important: deterministic checks take precedence over LLM opinion.

### Publisher and analytics agents

- Publisher accepts only an approved, checksum-verified package and uses resumable upload.
- Analytics stores raw snapshots at 24h, 72h, 7d, and 30d; it proposes evidence-linked changes rather than automatically rewriting strategy.

## 7. Quality gates

### Research gate

- Every material factual claim maps to at least one accessible source.
- Time-sensitive claims include an as-of date.
- Source quality and conflicts are visible.
- Duplicate or near-duplicate topics are flagged.

### Script gate

- Word count fits configured duration based on measured narrator WPM.
- Hook, promised value, sections, payoff, and CTA are present.
- Unsupported claims, prohibited language, and suspicious copied passages are blocked.

### Media gate

- Valid MP4 container; H.264 video and AAC audio for the first profile.
- Correct 16:9 resolution, frame rate, loudness target, peak limit, and black/silence thresholds.
- Scene coverage, caption timing, safe areas, spelling, and asset license records pass.
- Thumbnail passes size/aspect/readability checks.

### Publishing gate

- Final checksum matches approved render.
- Metadata length/format and chapter timestamps validate.
- Audience, paid-promotion, copyright, privacy, and altered/synthetic-content decisions are explicit.
- Schedule is valid in the channel timezone.
- Human confirms the final YouTube preview.

## 8. Security and compliance

- Store OAuth refresh tokens and provider keys in a secret manager, never the database or logs.
- Encrypt sensitive values at rest and use least-privilege OAuth scopes.
- Sanitize fetched web content as untrusted data; never treat it as agent instructions.
- Add prompt-injection defenses: source/content separation, strict schemas, URL allow/deny rules, and tool permissions per worker.
- Maintain asset provenance and license evidence; reject unknown-license assets by default.
- Implement per-provider budgets, rate limits, and emergency kill switches.
- Log publish approvals and all externally visible mutations.
- Add data retention and deletion policies before onboarding additional users/channels.

## 9. Delivery phases

### Phase 0 — Discovery and architecture lock (2–3 days)

Deliverables:

- channel brief and one reference video format;
- provider/cost decision matrix;
- architecture decision records;
- state diagram, initial ERD, API conventions, and threat model;
- measurable MVP acceptance criteria.

Exit criteria: niche, language, target duration, weekly volume, quality bar, monthly budget, source policy, narrator policy, deployment target, and approval points are explicitly decided.

### Phase 1 — Control Center foundation (1 week)

Deliverables:

- monorepo, local Docker environment, CI, migrations, seed data;
- channel/brand settings;
- video project list/detail pages and state timeline;
- workflow/event/job tables;
- worker skeleton, idempotency, retries, and artifact versioning;
- basic authentication and secret configuration.

Exit criteria: a user can create a project, approve/reject stages, retry a simulated failure, and inspect an immutable event trail.

### Phase 2 — Topic, research, script, and fact checking (1–2 weeks)

Deliverables:

- provider adapter and structured-output validation;
- topic scoring and duplicate detection;
- research package with citations;
- claim ledger;
- script editor, revisions, approval flow, and initial eval fixtures.

Exit criteria: an approved topic produces a timed, cited script with zero unresolved high-risk claims.

### Phase 3 — Storyboard and production manifest (1 week)

Deliverables:

- scene schema/editor;
- narration-to-scene mapping;
- asset routing policies;
- deterministic render manifest.

Exit criteria: every script sentence and required visual is represented; estimated scene duration reconciles with target duration.

### Phase 4 — Voice, visuals, and asset management (1–2 weeks)

Deliverables:

- TTS adapter, pronunciation dictionary, audio normalization/alignment;
- image/stock/diagram adapters;
- asset browser, provenance/license ledger, caching, and regeneration controls;
- cost estimation before generation.

Exit criteria: all scenes have technically valid, reviewable, licensed/provenanced assets within the approved budget.

### Phase 5 — Video engine and automated QA (2 weeks)

Deliverables:

- FFmpeg scene renderer and final compositor;
- captions, text overlays, transitions, music ducking, branding, intro/outro;
- preview/low-resolution render and final render profiles;
- ffprobe/audio/caption/black-frame/silence QA plus manual review screen.

Exit criteria: two consecutive sample projects render deterministically, survive a worker restart, and pass the defined QA profile.

### Phase 6 — Thumbnail and SEO package (1 week)

Deliverables:

- three thumbnail candidates, preview at mobile size, selection flow;
- title variants, description, chapters, keywords/tags, disclosure recommendation;
- publish package export.

Exit criteria: one approved package contains every artifact required for manual YouTube Studio upload.

**MVP release point:** stop here, publish at least three videos manually, and use the findings to correct the pipeline before API automation.

### Phase 7 — YouTube integration and scheduling (1–2 weeks plus external audit lead time)

Implementation status: complete in dual-mode form. Local demo mode exercises private upload, duplicate protection, thumbnail choice, future scheduling, publication, and reconciliation without external effects. Live mode uses OAuth and the YouTube APIs for resumable upload, status updates, and reconciliation; it remains unavailable until the operator supplies credentials and explicitly selects the YouTube provider.

Deliverables:

- OAuth connection flow and secure token storage;
- resumable, idempotent uploads with progress/recovery;
- thumbnail, playlist, metadata, audience/privacy, disclosure, and scheduling support where exposed by the API;
- post-upload processing/status verification and reconciliation job.

Exit criteria: a sandbox/private video can be uploaded exactly once, resumed after interruption, verified, and recorded with its YouTube ID. Public automation waits for required project compliance/audit clearance.

### Phase 8 — Analytics and learning loop (1–2 weeks)

Implementation status: local-first vertical slice complete. The app stores the four canonical snapshots, renders a channel/project dashboard, compares performance against explicit working baselines, and requires human decisions on evidence-linked recommendations. The YouTube Analytics adapter is implemented but remains opt-in until OAuth is configured, the connection is authorized for read-only analytics, and a project has a recorded YouTube video ID. Automated wall-clock scheduling and cohort-derived baselines are deferred to the hardening phase.

Deliverables:

- scheduled analytics snapshots;
- dashboard for views, watch time, average duration/percentage, subscribers and other available metrics;
- per-video performance brief and evidence-linked recommendations;
- experiment registry for title/thumbnail/content hypotheses.

Exit criteria: the system compares cohorts against channel baselines and proposes—not silently applies—strategy changes.

### Phase 9 — Hardening and controlled autonomy (ongoing)

Implementation status: initial hardening slice complete. The local control center exposes human-readable and JSON health reports, SQLite integrity checks and consistent backup snapshots, failed-job visibility, provider readiness diagnostics, monthly budget thresholds, and concurrent job claiming. Production deployment work—automated restore drills, external alert delivery, distributed leases, provider circuit breakers, and golden media regression fixtures—remains ongoing by design.

- failure drills, backup/restore, quota and budget alarms;
- prompt/model regression suite and golden render tests;
- concurrency controls and provider fallback policies;
- optional automation of low-risk approvals after measured quality targets are sustained.

## 10. Test strategy

- Unit tests for scoring, state transitions, validators, timing, cost, and disclosure rules.
- Contract tests for every provider adapter using recorded/sanitized fixtures.
- Workflow integration tests with injected retries, timeouts, invalid JSON, and worker restarts.
- Golden-file tests for structured artifacts and short deterministic render fixtures.
- Media probes for codecs, duration, resolution, frame rate, audio peaks/loudness, and caption bounds.
- End-to-end test that runs with fake paid providers and creates a 30–60 second package.
- Manual editorial rubric for factuality, hook strength, pacing, visual relevance, and brand fit.
- Prompt evaluation set containing normal cases, stale claims, conflicting sources, prompt injection, policy-sensitive content, and malformed provider responses.

## 11. Definition of done for each feature

A feature is complete only when it has:

- typed inputs/outputs and validation;
- database migration and rollback path when applicable;
- authorization and audit behavior;
- idempotency/retry behavior;
- tests for success and failure paths;
- logs, metrics, and actionable error messages;
- documented provider cost/quota impact;
- UI state for loading, empty, success, failure, retry, and approval;
- no secrets or sensitive source content in logs.

## 12. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated or stale facts | Claim ledger, approved sources, dates, deterministic coverage checks, manual gate |
| Low-quality generic output | Strong channel/format brief, reference eval set, revision history, editorial scoring |
| Runaway API cost | Preflight estimate, budgets, caching, low-res previews, per-stage approval |
| Copyright/licensing problems | Provenance ledger, approved providers, license capture, unknown-license rejection |
| Duplicate uploads | Idempotency keys, persistent upload session, reconciliation by stored YouTube ID |
| Workflow stuck after crash | Durable state, leased jobs, heartbeats, bounded retries, resumable render/upload |
| Provider lock-in | Small provider interfaces and canonical internal schemas |
| Policy violations | Explicit content/audience/disclosure checklist; block public publishing on uncertainty |
| Weak analytics conclusions | Baselines, minimum sample sizes, confidence labels, human-approved experiments |
| Overengineered MVP | One channel/format/language, modular monolith, defer autonomous publishing |

## 13. Cost and capacity controls

Before implementation, define a target cost per published minute and monthly ceiling. Track separately:

- research/search;
- LLM tokens by stage;
- image/video generation per asset;
- TTS characters/minutes;
- stock licenses;
- storage/egress;
- render compute;
- failed/repeated work.

The dashboard should show estimated cost before an expensive stage, actual cost afterward, and variance. Asset reuse and content-addressed caching should be built in before high-volume generation.

## 14. Initial API surface

```text
POST   /channels
GET    /channels/{id}
PATCH  /channels/{id}
POST   /video-projects
GET    /video-projects/{id}
GET    /video-projects/{id}/timeline
POST   /video-projects/{id}/actions/{action}
POST   /video-projects/{id}/approvals
GET    /video-projects/{id}/artifacts
POST   /video-projects/{id}/steps/{step}/retry
POST   /video-projects/{id}/render-preview
POST   /video-projects/{id}/render-final
POST   /video-projects/{id}/publish
GET    /workflow-runs/{id}
GET    /jobs/{id}
```

Mutation endpoints accept an idempotency key. Stage actions are commands validated against the current state, not arbitrary status updates.

## 15. First implementation sprint

Once Phase 0 decisions are answered, implement this vertical slice:

1. Scaffold web, API, worker, Postgres, Redis, object storage, migrations, CI, and configuration.
2. Create channel/brand profile and video project entities.
3. Implement the state transition service, event log, approvals, artifact revisions, and idempotent jobs.
4. Build project list/detail/timeline and channel settings screens.
5. Add a fake workflow step that writes a versioned JSON artifact to storage.
6. Demonstrate approval, rejection, retry, crash recovery, and audit history.
7. Lock the contracts, then integrate the first real topic/research provider in Sprint 2.

## 16. Decisions required before coding

The following answers materially affect implementation and should be recorded in a short product brief:

1. Channel niche and target viewer.
2. Primary language/accent and whether the narrator is synthetic or a consented clone.
3. Long-form, Shorts, or both; target duration and weekly volume.
4. Monthly operating budget and acceptable cost per finished video/minute.
5. Preferred AI/search/image/video/TTS providers, if any.
6. Local-only development versus immediate cloud deployment.
7. Required review gates and who approves them.
8. Allowed source types and factual-risk tolerance.
9. Visual style and three representative channels/videos.
10. Whether the first milestone ends at a local publish package or private YouTube upload.

## 17. Recommended success metrics

Engineering metrics for the MVP:

- at least 95% workflow completion without manual technical intervention;
- zero duplicate uploads;
- 100% of material factual claims linked to reviewed source evidence;
- 100% of external assets have provenance/license records;
- render duration and spend stay within the configured project budgets;
- failed jobs resume without restarting completed expensive steps;
- a complete audit trail exists for every public artifact.

Content metrics should initially establish baselines, not hard guarantees. After enough comparable releases, track click-through behavior where available, first-30-second retention, average percentage viewed, watch time, returning viewers, subscribers gained per thousand views, and cost per qualified viewing hour.
