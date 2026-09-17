export const projectStates = [
  "DRAFT_IDEA",
  "TOPIC_REVIEW",
  "RESEARCHING",
  "RESEARCH_REVIEW",
  "SCRIPTING",
  "SCRIPT_REVIEW",
  "STORYBOARDING",
  "ASSET_GENERATION",
  "RENDERING",
  "QA_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISH_APPROVAL",
  "UPLOADING",
  "UPLOADED_PRIVATE",
  "SCHEDULED",
  "PUBLISHED",
  "ANALYZING",
  "FAILED_RETRYABLE",
  "FAILED_BLOCKED",
  "CANCELLED",
] as const;

export type ProjectState = (typeof projectStates)[number];

export type VideoFormat = "LONG_FORM" | "SHORT";

export type VideoProject = {
  id: string;
  title: string;
  state: ProjectState;
  targetDurationMinutes: number;
  format: VideoFormat;
  language: string;
  createdAt: string;
  updatedAt: string;
};

const transitions: Partial<Record<ProjectState, readonly ProjectState[]>> = {
  DRAFT_IDEA: ["TOPIC_REVIEW", "CANCELLED"],
  TOPIC_REVIEW: ["RESEARCHING", "DRAFT_IDEA", "CANCELLED"],
  RESEARCHING: ["RESEARCH_REVIEW", "TOPIC_REVIEW", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  RESEARCH_REVIEW: ["SCRIPTING", "RESEARCHING", "TOPIC_REVIEW", "CANCELLED"],
  SCRIPTING: ["SCRIPT_REVIEW", "TOPIC_REVIEW", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  SCRIPT_REVIEW: ["STORYBOARDING", "SCRIPTING", "TOPIC_REVIEW", "CANCELLED"],
  STORYBOARDING: ["ASSET_GENERATION", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  ASSET_GENERATION: ["RENDERING", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  RENDERING: ["QA_REVIEW", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  QA_REVIEW: ["READY_TO_PUBLISH", "STORYBOARDING", "RENDERING", "CANCELLED"],
  READY_TO_PUBLISH: ["PUBLISH_APPROVAL", "QA_REVIEW", "CANCELLED"],
  PUBLISH_APPROVAL: ["UPLOADING", "READY_TO_PUBLISH", "CANCELLED"],
  UPLOADING: ["UPLOADED_PRIVATE", "SCHEDULED", "PUBLISHED", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  UPLOADED_PRIVATE: ["SCHEDULED", "PUBLISHED", "CANCELLED"],
  SCHEDULED: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["ANALYZING"],
  ANALYZING: ["ANALYZING", "FAILED_RETRYABLE", "FAILED_BLOCKED"],
  FAILED_RETRYABLE: ["RESEARCHING", "SCRIPTING", "STORYBOARDING", "ASSET_GENERATION", "RENDERING", "UPLOADING", "ANALYZING", "FAILED_BLOCKED", "CANCELLED"],
  FAILED_BLOCKED: ["CANCELLED"],
};

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: ProjectState, to: ProjectState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid project transition: ${from} -> ${to}`);
  }
}
