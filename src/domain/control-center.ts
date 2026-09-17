export const artifactTypes = ["TOPIC_BRIEF", "RESEARCH_BRIEF", "SCRIPT", "STORYBOARD", "RENDER_MANIFEST", "ASSET_PLAN", "VOICE_MANIFEST", "SEO_PACKAGE", "PUBLISH_PACKAGE"] as const;
export type ArtifactType = (typeof artifactTypes)[number];
export type ArtifactStatus = "DRAFT" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ChannelProfile = {
  channelName: string; niche: string; targetAudience: string; language: string;
  timezone: string; defaultDurationMinutes: number; weeklyFrequency: number;
  tone: string; visualStyle: string; brandColors: string; narratorStyle: string;
  prohibitedTopics: string; updatedAt: string;
};

export const nextArtifactVersion = (highest: number | null) => (highest ?? 0) + 1;
export const canRetryJob = (status: JobStatus, attempt: number, maxAttempts: number) => status === "FAILED" && attempt < maxAttempts;
