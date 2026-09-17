import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/control-center.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS video_projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    target_duration_minutes INTEGER NOT NULL,
    video_format TEXT NOT NULL DEFAULT 'LONG_FORM',
    language TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES video_projects(id),
    event_type TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT,
    reason TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_project_events_project_created
  ON project_events(project_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS channel_profiles (
    id TEXT PRIMARY KEY CHECK (id = 'default'), channel_name TEXT NOT NULL,
    niche TEXT NOT NULL, target_audience TEXT NOT NULL, language TEXT NOT NULL,
    timezone TEXT NOT NULL, default_duration_minutes INTEGER NOT NULL,
    weekly_frequency INTEGER NOT NULL, tone TEXT NOT NULL, visual_style TEXT NOT NULL,
    brand_colors TEXT NOT NULL, narrator_style TEXT NOT NULL,
    prohibited_topics TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    artifact_type TEXT NOT NULL, version INTEGER NOT NULL, content_json TEXT NOT NULL,
    checksum TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('DRAFT','APPROVED','REJECTED','SUPERSEDED')),
    created_at TEXT NOT NULL, UNIQUE(project_id, artifact_type, version)
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    stage TEXT NOT NULL, artifact_id TEXT REFERENCES artifacts(id),
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
    reviewer TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workflow_jobs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    job_type TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100), attempt INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, error_message TEXT,
    estimated_cost_usd REAL NOT NULL DEFAULT 0, actual_cost_usd REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS topic_candidates (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    title TEXT NOT NULL, audience TEXT NOT NULL, intent TEXT NOT NULL,
    primary_keyword TEXT NOT NULL, hook TEXT NOT NULL, rationale TEXT NOT NULL,
    demand INTEGER NOT NULL, audience_fit INTEGER NOT NULL, competition INTEGER NOT NULL,
    click_potential INTEGER NOT NULL, evergreen INTEGER NOT NULL, freshness INTEGER NOT NULL,
    business_value INTEGER NOT NULL, total_score REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROPOSED','APPROVED','REJECTED')),
    provider TEXT NOT NULL, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS research_sources (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    title TEXT NOT NULL, url TEXT NOT NULL, publisher TEXT NOT NULL,
    published_at TEXT, accessed_at TEXT NOT NULL, trust_level TEXT NOT NULL
      CHECK (trust_level IN ('PRIMARY','HIGH','MEDIUM','LOW')),
    notes TEXT NOT NULL, UNIQUE(project_id, url)
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    claim_text TEXT NOT NULL, source_id TEXT REFERENCES research_sources(id),
    support_status TEXT NOT NULL CHECK (support_status IN ('SUPPORTED','PARTIAL','UNSUPPORTED','STALE')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
    evidence TEXT NOT NULL, as_of_date TEXT, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    scene_id TEXT, asset_kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PLANNED','READY','FAILED','REJECTED')),
    uri TEXT NOT NULL, provider TEXT NOT NULL, prompt TEXT NOT NULL,
    license TEXT NOT NULL, provenance TEXT NOT NULL, checksum TEXT NOT NULL,
    mime_type TEXT NOT NULL, estimated_cost_usd REAL NOT NULL DEFAULT 0,
    actual_cost_usd REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
    UNIQUE(project_id, scene_id, asset_kind)
  );
  CREATE TABLE IF NOT EXISTS renders (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    status TEXT NOT NULL, video_uri TEXT NOT NULL, captions_uri TEXT NOT NULL,
    duration_seconds REAL NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    video_codec TEXT NOT NULL, audio_codec TEXT NOT NULL, qa_json TEXT NOT NULL,
    checksum TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS youtube_connections (
    id TEXT PRIMARY KEY CHECK(id='default'), access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL, expires_at TEXT NOT NULL, scope TEXT NOT NULL,
    connected_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS youtube_uploads (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    status TEXT NOT NULL, session_url TEXT, youtube_video_id TEXT,
    bytes_uploaded INTEGER NOT NULL DEFAULT 0, total_bytes INTEGER NOT NULL,
    privacy_status TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, UNIQUE(project_id)
  );
  CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    youtube_video_id TEXT, window_hours INTEGER NOT NULL,
    captured_at TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('demo','youtube')),
    views INTEGER NOT NULL, estimated_minutes_watched REAL NOT NULL,
    average_view_duration REAL NOT NULL, average_view_percentage REAL NOT NULL,
    subscribers_gained INTEGER NOT NULL, likes INTEGER NOT NULL, comments INTEGER NOT NULL,
    impressions INTEGER, impression_ctr REAL,
    UNIQUE(project_id, window_hours)
  );
  CREATE TABLE IF NOT EXISTS performance_recommendations (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    category TEXT NOT NULL, finding TEXT NOT NULL, recommendation TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK(confidence IN ('LOW','MEDIUM','HIGH')),
    evidence_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PROPOSED','APPROVED','REJECTED')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS publication_records (
    project_id TEXT PRIMARY KEY REFERENCES video_projects(id), mode TEXT NOT NULL,
    selected_thumbnail TEXT NOT NULL, privacy_status TEXT NOT NULL,
    scheduled_at TEXT, published_at TEXT, reconciled_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id),
    recommendation_id TEXT REFERENCES performance_recommendations(id),
    hypothesis TEXT NOT NULL, variable TEXT NOT NULL, status TEXT NOT NULL,
    started_at TEXT, completed_at TEXT, result TEXT, created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_artifacts_project_type ON artifacts(project_id, artifact_type, version DESC);
  CREATE INDEX IF NOT EXISTS idx_approvals_project_created ON approvals(project_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_project_created ON workflow_jobs(project_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_topics_project_score ON topic_candidates(project_id, total_score DESC);
  CREATE INDEX IF NOT EXISTS idx_sources_project ON research_sources(project_id, accessed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id, support_status, risk_level);
  CREATE INDEX IF NOT EXISTS idx_media_assets_project ON media_assets(project_id, scene_id);
  CREATE INDEX IF NOT EXISTS idx_renders_project ON renders(project_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_analytics_project_window ON analytics_snapshots(project_id, window_hours);
  CREATE INDEX IF NOT EXISTS idx_recommendations_project ON performance_recommendations(project_id, created_at DESC);
`);

try {
  const columns = (db.prepare("PRAGMA table_info(video_projects)").all() as Array<{name:string}>).map(c=>c.name);
  if(!columns.includes("video_format")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN video_format TEXT NOT NULL DEFAULT 'LONG_FORM';");
  }
} catch {
  // Ignored if column already exists or table freshly created
}

export { db };
