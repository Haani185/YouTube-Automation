import { z } from "zod";
import { projectStates } from "./video-project";
import { artifactTypes } from "./control-center";

export const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(120),
  targetDurationMinutes: z.coerce.number().int().min(1).max(180).default(8),
  format: z.enum(["LONG_FORM", "SHORT"]).default("LONG_FORM"),
  language: z.string().trim().min(2).max(40).default("English"),
});

export const transitionProjectSchema = z.object({
  to: z.enum(projectStates),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
});

export const channelProfileSchema = z.object({
  channelName: z.string().trim().min(2).max(100), niche: z.string().trim().min(3).max(200),
  targetAudience: z.string().trim().min(3).max(500), language: z.string().trim().min(2).max(40),
  timezone: z.string().trim().min(3).max(80), defaultDurationMinutes: z.coerce.number().int().min(1).max(180),
  weeklyFrequency: z.coerce.number().int().min(1).max(14), tone: z.string().trim().min(3).max(500),
  visualStyle: z.string().trim().min(3).max(500), brandColors: z.string().trim().min(3).max(200),
  narratorStyle: z.string().trim().min(3).max(300), prohibitedTopics: z.string().trim().max(1000),
});

export const createArtifactSchema = z.object({ artifactType: z.enum(artifactTypes), content: z.record(z.string(), z.unknown()) });
export const approvalSchema = z.object({ stage: z.string().trim().min(2).max(80), artifactId: z.string().uuid().nullable().optional(), decision: z.enum(["APPROVED", "REJECTED"]), reviewer: z.string().trim().min(2).max(100), notes: z.string().trim().min(3).max(1000) });
export const createJobSchema = z.object({ jobType: z.string().trim().min(2).max(80), maxAttempts: z.coerce.number().int().min(1).max(10).default(3), estimatedCostUsd: z.coerce.number().min(0).max(10000).default(0), idempotencyKey: z.string().uuid() });
