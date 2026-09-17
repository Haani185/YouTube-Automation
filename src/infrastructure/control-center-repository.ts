import { createHash, randomUUID } from "node:crypto";
import { db } from "./database";
import { nextArtifactVersion, type ArtifactStatus, type ArtifactType, type ChannelProfile, type JobStatus } from "@/domain/control-center";

export type Artifact = { id: string; projectId: string; artifactType: ArtifactType; version: number; content: Record<string, unknown>; checksum: string; status: ArtifactStatus; createdAt: string };
export type Approval = { id: string; stage: string; artifactId: string | null; decision: "APPROVED" | "REJECTED"; reviewer: string; notes: string; createdAt: string };
export type WorkflowJob = { id: string; jobType: string; status: JobStatus; progress: number; attempt: number; maxAttempts: number; errorMessage: string | null; estimatedCostUsd: number; actualCostUsd: number; createdAt: string; updatedAt: string };

const defaults: Omit<ChannelProfile, "updatedAt"> = {
  channelName: "My AI Channel", niche: "AI tools and practical business automation",
  targetAudience: "Small-business owners who want practical, time-saving systems",
  language: "English", timezone: "Asia/Karachi", defaultDurationMinutes: 8, weeklyFrequency: 1,
  tone: "Clear, credible, practical, and concise",
  visualStyle: "Modern documentary explainer with restrained motion graphics",
  brandColors: "#ff4d57, #ff8a4c, #090b0f",
  narratorStyle: "Warm neutral synthetic voice; 145 words per minute",
  prohibitedTopics: "Unverified financial promises, medical claims, impersonation, deceptive clickbait",
};

export function getChannelProfile(): ChannelProfile {
  const r = db.prepare("SELECT * FROM channel_profiles WHERE id='default'").get() as Record<string, unknown> | undefined;
  if (!r) return { ...defaults, updatedAt: new Date(0).toISOString() };
  return { channelName: r.channel_name as string, niche: r.niche as string, targetAudience: r.target_audience as string, language: r.language as string, timezone: r.timezone as string, defaultDurationMinutes: r.default_duration_minutes as number, weeklyFrequency: r.weekly_frequency as number, tone: r.tone as string, visualStyle: r.visual_style as string, brandColors: r.brand_colors as string, narratorStyle: r.narrator_style as string, prohibitedTopics: r.prohibited_topics as string, updatedAt: r.updated_at as string };
}

export function saveChannelProfile(p: Omit<ChannelProfile, "updatedAt">): ChannelProfile {
  const updatedAt = new Date().toISOString();
  db.prepare(`INSERT INTO channel_profiles VALUES ('default',?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET channel_name=excluded.channel_name,niche=excluded.niche,target_audience=excluded.target_audience,language=excluded.language,timezone=excluded.timezone,default_duration_minutes=excluded.default_duration_minutes,weekly_frequency=excluded.weekly_frequency,tone=excluded.tone,visual_style=excluded.visual_style,brand_colors=excluded.brand_colors,narrator_style=excluded.narrator_style,prohibited_topics=excluded.prohibited_topics,updated_at=excluded.updated_at`)
    .run(p.channelName,p.niche,p.targetAudience,p.language,p.timezone,p.defaultDurationMinutes,p.weeklyFrequency,p.tone,p.visualStyle,p.brandColors,p.narratorStyle,p.prohibitedTopics,updatedAt);
  return { ...p, updatedAt };
}

export function createArtifact(projectId: string, artifactType: ArtifactType, content: Record<string, unknown>): Artifact {
  const serialized = JSON.stringify(content);
  const current = db.prepare("SELECT MAX(version) version FROM artifacts WHERE project_id=? AND artifact_type=?").get(projectId, artifactType) as { version: number | null };
  const artifact: Artifact = { id: randomUUID(), projectId, artifactType, version: nextArtifactVersion(current.version), content, checksum: createHash("sha256").update(serialized).digest("hex"), status: "DRAFT", createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO artifacts VALUES (?,?,?,?,?,?,?,?)").run(artifact.id,projectId,artifactType,artifact.version,serialized,artifact.checksum,artifact.status,artifact.createdAt);
  return artifact;
}

export function listArtifacts(projectId: string): Artifact[] {
  return (db.prepare("SELECT * FROM artifacts WHERE project_id=? ORDER BY created_at DESC").all(projectId) as Record<string, unknown>[]).map(r => ({ id:r.id as string, projectId:r.project_id as string, artifactType:r.artifact_type as ArtifactType, version:r.version as number, content:JSON.parse(r.content_json as string), checksum:r.checksum as string, status:r.status as ArtifactStatus, createdAt:r.created_at as string }));
}

export function recordApproval(projectId: string, input: Omit<Approval,"id"|"createdAt">): Approval {
  const approval = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
  db.exec("BEGIN IMMEDIATE");
  try {
    if (input.artifactId) {
      const changed = db.prepare("UPDATE artifacts SET status=? WHERE id=? AND project_id=?").run(input.decision,input.artifactId,projectId);
      if (changed.changes !== 1) throw new Error("Artifact not found");
    }
    db.prepare("INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?)").run(approval.id,projectId,input.stage,input.artifactId ?? null,input.decision,input.reviewer,input.notes,approval.createdAt);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return approval;
}

export function listApprovals(projectId: string): Approval[] {
  return (db.prepare("SELECT * FROM approvals WHERE project_id=? ORDER BY created_at DESC").all(projectId) as Record<string, unknown>[]).map(r => ({ id:r.id as string, stage:r.stage as string, artifactId:r.artifact_id as string|null, decision:r.decision as Approval["decision"], reviewer:r.reviewer as string, notes:r.notes as string, createdAt:r.created_at as string }));
}

export function createWorkflowJob(projectId: string, input: { jobType:string; maxAttempts:number; estimatedCostUsd:number; idempotencyKey:string }): WorkflowJob {
  const prior = db.prepare("SELECT * FROM workflow_jobs WHERE idempotency_key=?").get(input.idempotencyKey) as Record<string,unknown>|undefined;
  if (prior) return mapJob(prior);
  const now = new Date().toISOString();
  const job = { id:randomUUID(), jobType:input.jobType, status:"QUEUED" as const, progress:0, attempt:0, maxAttempts:input.maxAttempts, errorMessage:null, estimatedCostUsd:input.estimatedCostUsd, actualCostUsd:0, createdAt:now, updatedAt:now };
  db.prepare("INSERT INTO workflow_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(job.id,projectId,job.jobType,job.status,job.progress,job.attempt,job.maxAttempts,input.idempotencyKey,null,job.estimatedCostUsd,job.actualCostUsd,now,now);
  return job;
}

function mapJob(r: Record<string,unknown>): WorkflowJob { return { id:r.id as string, jobType:r.job_type as string, status:r.status as JobStatus, progress:r.progress as number, attempt:r.attempt as number, maxAttempts:r.max_attempts as number, errorMessage:r.error_message as string|null, estimatedCostUsd:r.estimated_cost_usd as number, actualCostUsd:r.actual_cost_usd as number, createdAt:r.created_at as string, updatedAt:r.updated_at as string }; }
export function listWorkflowJobs(projectId:string): WorkflowJob[] { return (db.prepare("SELECT * FROM workflow_jobs WHERE project_id=? ORDER BY created_at DESC").all(projectId) as Record<string,unknown>[]).map(mapJob); }

export function runNextWorkflowJob(projectId: string): WorkflowJob | null {
  const queued = db.prepare("SELECT * FROM workflow_jobs WHERE project_id=? AND status='QUEUED' ORDER BY created_at LIMIT 1").get(projectId) as Record<string,unknown>|undefined;
  if (!queued) return null;
  const jobId = queued.id as string;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const claimed = db.prepare("UPDATE workflow_jobs SET status='RUNNING',progress=10,attempt=attempt+1,updated_at=? WHERE id=? AND status='QUEUED'").run(now, jobId);
    if (claimed.changes !== 1) throw new Error("Job was claimed by another worker");
    db.prepare("UPDATE workflow_jobs SET status='SUCCEEDED',progress=100,updated_at=? WHERE id=? AND status='RUNNING'").run(new Date().toISOString(), jobId);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return mapJob(db.prepare("SELECT * FROM workflow_jobs WHERE id=?").get(jobId) as Record<string,unknown>);
}
