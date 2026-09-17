import { randomUUID } from "node:crypto";
import { db } from "./database";
import { assertTransition, type ProjectState, type VideoFormat, type VideoProject } from "@/domain/video-project";

type ProjectRow = {
  id: string;
  title: string;
  state: ProjectState;
  target_duration_minutes: number;
  video_format?: VideoFormat;
  language: string;
  created_at: string;
  updated_at: string;
};

export type ProjectEvent = {
  id: string;
  eventType: string;
  fromState: ProjectState | null;
  toState: ProjectState;
  reason: string;
  createdAt: string;
};

function mapProject(row: ProjectRow): VideoProject {
  return {
    id: row.id,
    title: row.title,
    state: row.state,
    targetDurationMinutes: row.target_duration_minutes,
    format: row.video_format === "SHORT" ? "SHORT" : "LONG_FORM",
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(): VideoProject[] {
  const rows = db.prepare("SELECT * FROM video_projects ORDER BY updated_at DESC").all() as ProjectRow[];
  return rows.map(mapProject);
}

export function getProject(id: string): VideoProject | null {
  const row = db.prepare("SELECT * FROM video_projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return row ? mapProject(row) : null;
}

export function deleteProject(id:string):boolean{
  if(!getProject(id))return false;
  const tables=["experiments","performance_recommendations","analytics_snapshots","publication_records","youtube_uploads","renders","media_assets","claims","research_sources","approvals","artifacts","workflow_jobs","topic_candidates","project_events"];
  db.exec("BEGIN IMMEDIATE");
  try{for(const table of tables)db.prepare(`DELETE FROM ${table} WHERE project_id=?`).run(id);const result=db.prepare("DELETE FROM video_projects WHERE id=?").run(id);db.exec("COMMIT");return result.changes===1;}catch(error){db.exec("ROLLBACK");throw error;}
}

export function createProject(input: { title: string; targetDurationMinutes: number; language: string; format?: VideoFormat }): VideoProject {
  const now = new Date().toISOString();
  const format: VideoFormat = input.format === "SHORT" ? "SHORT" : "LONG_FORM";
  const project: VideoProject = { id: randomUUID(), state: "DRAFT_IDEA", format, createdAt: now, updatedAt: now, ...input };
  const eventId = randomUUID();
  const idempotencyKey = randomUUID();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO video_projects
      (id, title, state, target_duration_minutes, video_format, language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(project.id, project.title, project.state, project.targetDurationMinutes, format, project.language, now, now);
    db.prepare(`INSERT INTO project_events
      (id, project_id, event_type, from_state, to_state, reason, idempotency_key, created_at)
      VALUES (?, ?, 'PROJECT_CREATED', NULL, ?, 'Project created', ?, ?)`)
      .run(eventId, project.id, project.state, idempotencyKey, now);
    db.exec("COMMIT");
    return project;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function transitionProject(input: { projectId: string; to: ProjectState; reason: string; idempotencyKey: string }): VideoProject {
  const existing = getProject(input.projectId);
  if (!existing) throw new Error("Project not found");

  const prior = db.prepare("SELECT project_id FROM project_events WHERE idempotency_key = ?").get(input.idempotencyKey) as { project_id: string } | undefined;
  if (prior) {
    if (prior.project_id !== input.projectId) throw new Error("Idempotency key belongs to another project");
    return existing;
  }

  assertTransition(existing.state, input.to);
  const now = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare("UPDATE video_projects SET state = ?, updated_at = ? WHERE id = ? AND state = ?")
      .run(input.to, now, input.projectId, existing.state);
    if (update.changes !== 1) throw new Error("Project changed concurrently; reload and retry");
    db.prepare(`INSERT INTO project_events
      (id, project_id, event_type, from_state, to_state, reason, idempotency_key, created_at)
      VALUES (?, ?, 'STATE_CHANGED', ?, ?, ?, ?, ?)`)
      .run(randomUUID(), input.projectId, existing.state, input.to, input.reason, input.idempotencyKey, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getProject(input.projectId)!;
}

export function listProjectEvents(projectId: string): ProjectEvent[] {
  const rows = db.prepare(`SELECT id, event_type, from_state, to_state, reason, created_at
    FROM project_events WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Array<{
      id: string; event_type: string; from_state: ProjectState | null; to_state: ProjectState; reason: string; created_at: string;
    }>;
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    fromState: row.from_state,
    toState: row.to_state,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
