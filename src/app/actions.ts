"use server";

import { randomUUID } from "node:crypto";
import {rmSync} from "node:fs";
import {resolve,sep} from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approvalSchema, channelProfileSchema, createArtifactSchema, createJobSchema, createProjectSchema } from "@/domain/schemas";
import { createProject, deleteProject, getProject, transitionProject } from "@/infrastructure/project-repository";
import { createArtifact, createWorkflowJob, listArtifacts, recordApproval, runNextWorkflowJob, saveChannelProfile } from "@/infrastructure/control-center-repository";
import { getTopicGenerator } from "@/application/topic-generator";
import { approveTopic, listTopics, replaceProposedTopics } from "@/infrastructure/topic-repository";
import { getChannelProfile } from "@/infrastructure/control-center-repository";
import { claimInputSchema, researchGate, sourceInputSchema } from "@/domain/research";
import { addClaim, addSource, clearResearch, listClaims, listSources } from "@/infrastructure/research-repository";
import { generateGroundedScript, updateScriptDraft } from "@/application/script-generator";
import { createRenderManifest, generateStoryboard, validateStoryboard } from "@/domain/storyboard";
import type { ScriptDraft } from "@/application/script-generator";
import type { Storyboard } from "@/domain/storyboard";
import { generateLocalAssets } from "@/application/asset-generator";
import { assetCoverage, planAssets } from "@/domain/assets";
import { renderDemoVideo } from "@/application/video-renderer";
import { listRenders } from "@/application/video-renderer";
import { listMediaAssets } from "@/infrastructure/asset-repository";
import { buildPublishPackage } from "@/application/publish-package";
import type {SeoPackage} from "@/domain/publishing";
import {uploadPrivate} from "@/application/youtube-uploader";
import { ANALYTICS_WINDOWS, analyzePerformance, type AnalyticsWindow } from "@/domain/analytics";
import { collectAnalytics } from "@/application/analytics-provider";
import { decideRecommendation, listAnalyticsSnapshots, replaceProposedRecommendations, saveAnalyticsSnapshot } from "@/infrastructure/analytics-repository";
import { createDatabaseBackup } from "@/infrastructure/operations";
import { createExperiment, savePublication } from "@/infrastructure/publication-repository";
import { publishNow, reconcilePublication, schedulePublication } from "@/application/publication-service";
import { claimFromSource, findResearchSource } from "@/application/research-assistant";
import {disconnectYouTube} from "@/infrastructure/youtube-auth";

export async function createProjectAction(formData: FormData) {
  const input = createProjectSchema.parse({
    title: formData.get("title"),
    targetDurationMinutes: formData.get("targetDurationMinutes"),
    format: formData.get("format") || "LONG_FORM",
    language: formData.get("language"),
  });
  const project = createProject(input);
  redirect(`/projects/${project.id}`);
}

export async function deleteProjectAction(projectId:string){
  if(!getProject(projectId))return;
  deleteProject(projectId);
  const generatedRoot=resolve("public","generated"),target=resolve(generatedRoot,projectId);
  if(target.startsWith(`${generatedRoot}${sep}`))rmSync(target,{recursive:true,force:true});
  revalidatePath("/");
}

export async function disconnectYouTubeAction(){await disconnectYouTube();revalidatePath("/");revalidatePath("/settings");revalidatePath("/analytics");revalidatePath("/system");}

export async function submitTopicForReview(projectId: string) {
  transitionProject({
    projectId,
    to: "TOPIC_REVIEW",
    reason: "Submitted by operator for topic review",
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function saveChannelProfileAction(formData: FormData) {
  saveChannelProfile(channelProfileSchema.parse(Object.fromEntries(formData)));
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function createDraftArtifactAction(projectId: string, formData: FormData) {
  const input = createArtifactSchema.parse({ artifactType: formData.get("artifactType"), content: { summary: formData.get("summary"), createdBy: "operator" } });
  createArtifact(projectId, input.artifactType, input.content);
  revalidatePath(`/projects/${projectId}`);
}

export async function recordApprovalAction(projectId: string, formData: FormData) {
  const input = approvalSchema.parse({ stage: formData.get("stage"), artifactId: formData.get("artifactId") || null, decision: formData.get("decision"), reviewer: formData.get("reviewer"), notes: formData.get("notes") });
  recordApproval(projectId, { ...input, artifactId: input.artifactId ?? null });
  revalidatePath(`/projects/${projectId}`);
}

export async function createJobAction(projectId: string, formData: FormData) {
  const input = createJobSchema.parse({ jobType: formData.get("jobType"), maxAttempts: 3, estimatedCostUsd: formData.get("estimatedCostUsd"), idempotencyKey: randomUUID() });
  createWorkflowJob(projectId, input);
  revalidatePath(`/projects/${projectId}`);
}

export async function runNextJobAction(projectId: string) {
  runNextWorkflowJob(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateTopicsAction(projectId: string) {
  const project=getProject(projectId);if(!project||project.state!=="TOPIC_REVIEW")throw new Error("Project is not ready for topic generation");
  const generator = getTopicGenerator();
  const drafts = await generator.generate(getChannelProfile(),project.title);
  replaceProposedTopics(projectId, drafts, generator.provider);
  revalidatePath(`/projects/${projectId}`);
}

export async function restartTopicSelectionAction(projectId:string){const project=getProject(projectId);if(!project||!["RESEARCHING","RESEARCH_REVIEW","SCRIPTING","SCRIPT_REVIEW"].includes(project.state))throw new Error("Topic selection cannot be restarted from this stage");clearResearch(projectId);transitionProject({projectId,to:"TOPIC_REVIEW",reason:"Operator requested new topic candidates based on the project idea",idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/");}

export async function approveTopicAction(projectId: string, topicId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "TOPIC_REVIEW") throw new Error("Project is not awaiting topic approval");
  const topic = approveTopic(projectId, topicId);
  const artifact = createArtifact(projectId, "TOPIC_BRIEF", topic);
  recordApproval(projectId, { stage: "TOPIC_REVIEW", artifactId: artifact.id, decision: "APPROVED", reviewer: "Owner", notes: `Selected topic with weighted score ${topic.totalScore}` });
  transitionProject({ projectId, to: "RESEARCHING", reason: `Approved topic: ${topic.title}`, idempotencyKey: randomUUID() });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function addResearchSourceAction(projectId: string, formData: FormData) {
  const rawNotes = String(formData.get("notes") ?? "").trim();
  const notes = rawNotes.length > 10000 ? rawNotes.slice(0, 10000) : rawNotes;
  const parsed = sourceInputSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url"),
    publisher: formData.get("publisher"),
    publishedAt: formData.get("publishedAt") || null,
    trustLevel: formData.get("trustLevel"),
    notes,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Invalid source data: ${errorMsg}`);
  }

  try {
    addSource(projectId, { ...parsed.data, publishedAt: parsed.data.publishedAt ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE constraint failed")) {
      throw new Error("A source with this URL has already been added to this project.");
    }
    throw err;
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function addClaimAction(projectId: string, formData: FormData) {
  const parsed = claimInputSchema.safeParse({
    claimText: formData.get("claimText"),
    sourceId: formData.get("sourceId") || null,
    supportStatus: formData.get("supportStatus"),
    riskLevel: formData.get("riskLevel"),
    evidence: formData.get("evidence"),
    asOfDate: formData.get("asOfDate") || null,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Invalid claim data: ${errorMsg}`);
  }

  addClaim(projectId, { ...parsed.data, sourceId: parsed.data.sourceId ?? null, asOfDate: parsed.data.asOfDate ?? null });
  revalidatePath(`/projects/${projectId}`);
}

export async function generateResearchSourceAction(projectId:string){const project=getProject(projectId);if(!project||project.state!=="RESEARCHING")throw new Error("Sources can only be generated during research");const topic=listTopics(projectId).find(item=>item.status==="APPROVED");if(!topic)throw new Error("Approve a topic first");const draft=await findResearchSource(topic);if(!listSources(projectId).some(source=>source.url===draft.url))addSource(projectId,draft);revalidatePath(`/projects/${projectId}`);}

export async function generateResearchClaimAction(projectId:string){const project=getProject(projectId);if(!project||project.state!=="RESEARCHING")throw new Error("Claims can only be generated during research");const source=listSources(projectId)[0];if(!source)throw new Error("Generate or add a source first");const draft=claimFromSource(source);if(!listClaims(projectId).some(claim=>claim.claimText===draft.claimText))addClaim(projectId,draft);revalidatePath(`/projects/${projectId}`);}

export async function submitResearchForReviewAction(projectId:string){
  const project=getProject(projectId); if(!project||project.state!=="RESEARCHING")throw new Error("Project is not researching");
  const sources=listSources(projectId),claims=listClaims(projectId),gate=researchGate(claims); if(!gate.pass)throw new Error(gate.reasons.join("; "));
  createArtifact(projectId,"RESEARCH_BRIEF",{sources,claims,gate});
  transitionProject({projectId,to:"RESEARCH_REVIEW",reason:`Research package submitted with ${sources.length} sources and ${claims.length} claims`,idempotencyKey:randomUUID()}); revalidatePath(`/projects/${projectId}`);
}

export async function approveResearchAction(projectId:string){
  const project=getProject(projectId); if(!project||project.state!=="RESEARCH_REVIEW")throw new Error("Project is not awaiting research approval");
  const artifact=listArtifacts(projectId).find(a=>a.artifactType==="RESEARCH_BRIEF"&&a.status==="DRAFT"); if(!artifact)throw new Error("Research brief not found");
  recordApproval(projectId,{stage:"RESEARCH_REVIEW",artifactId:artifact.id,decision:"APPROVED",reviewer:"Owner",notes:"Research evidence and claim coverage approved"});
  transitionProject({projectId,to:"SCRIPTING",reason:"Research package approved",idempotencyKey:randomUUID()}); revalidatePath(`/projects/${projectId}`);
}

export async function generateScriptAction(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "SCRIPTING") throw new Error("Project is not ready for scripting");
  const topic = listTopics(projectId).find((t) => t.status === "APPROVED");
  if (!topic) throw new Error("Approved topic not found");
  const profile = getChannelProfile();
  const script = await generateGroundedScript(topic, listClaims(projectId), listSources(projectId), {
    targetDurationMinutes: project.targetDurationMinutes,
    format: project.format,
    tone: profile.tone,
    prohibitedTopics: profile.prohibitedTopics,
  });
  createArtifact(projectId, "SCRIPT", script);
  transitionProject({
    projectId,
    to: "SCRIPT_REVIEW",
    reason: `Grounded script generated with ${script.wordCount} words (${project.format})`,
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function updateScriptAction(projectId: string, formData: FormData) {
  const project = getProject(projectId);
  if (!project || project.state !== "SCRIPT_REVIEW") throw new Error("Project is not awaiting script review");
  const scriptArtifact = listArtifacts(projectId).find((a) => a.artifactType === "SCRIPT" && a.status === "DRAFT");
  if (!scriptArtifact) throw new Error("Draft script not found");
  const sectionIndex = Number(formData.get("sectionIndex"));
  const heading = String(formData.get("heading") ?? "");
  const narration = String(formData.get("narration") ?? "");
  const currentScript = scriptArtifact.content as unknown as ScriptDraft;
  const updated = updateScriptDraft(currentScript, sectionIndex, heading, narration);
  createArtifact(projectId, "SCRIPT", updated);
  revalidatePath(`/projects/${projectId}`);
}

export async function approveScriptAction(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "SCRIPT_REVIEW") throw new Error("Project is not awaiting script approval");
  const script = listArtifacts(projectId).find((a) => a.artifactType === "SCRIPT" && a.status === "DRAFT");
  if (!script) throw new Error("Script artifact not found");
  recordApproval(projectId, {
    stage: "SCRIPT_REVIEW",
    artifactId: script.id,
    decision: "APPROVED",
    reviewer: "Owner",
    notes: "Script structure and grounded claims approved",
  });
  transitionProject({
    projectId,
    to: "STORYBOARDING",
    reason: "Script approved for storyboard production",
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function generateStoryboardAction(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "STORYBOARDING") throw new Error("Project is not ready for storyboarding");
  const scriptArtifact = listArtifacts(projectId).find((a) => a.artifactType === "SCRIPT" && a.status === "APPROVED");
  if (!scriptArtifact) throw new Error("Approved script not found");
  const storyboard = generateStoryboard(scriptArtifact.content as unknown as ScriptDraft, 145, project.format);
  const issues = validateStoryboard(storyboard);
  if (issues.length) throw new Error(issues.join("; "));
  createArtifact(projectId, "STORYBOARD", storyboard);
  createArtifact(projectId, "RENDER_MANIFEST", createRenderManifest(storyboard, project.format));
  transitionProject({
    projectId,
    to: "ASSET_GENERATION",
    reason: `Storyboard generated with ${storyboard.scenes.length} scenes and ${storyboard.totalDurationSeconds}s timing (${project.format})`,
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function generateAssetsAction(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "ASSET_GENERATION") throw new Error("Project is not ready for asset generation");
  const storyboardArtifact = listArtifacts(projectId).find((a) => a.artifactType === "STORYBOARD");
  if (!storyboardArtifact) throw new Error("Storyboard not found");
  const storyboard = storyboardArtifact.content as unknown as Storyboard;
  const requirements = planAssets(storyboard);
  const assets = await generateLocalAssets(projectId, storyboard, project.format);
  const coverage = assetCoverage(storyboard.scenes.map((s) => s.id), assets);
  if (!coverage.pass) throw new Error(`Asset coverage incomplete: ${coverage.missing.join(", ")}`);
  createArtifact(projectId, "ASSET_PLAN", {
    requirements,
    coverage,
    totalEstimatedCostUsd: requirements.reduce((sum, r) => sum + r.estimatedCostUsd, 0),
  });
  const narration = assets.find((a) => a.assetKind === "NARRATION");
  createArtifact(projectId, "VOICE_MANIFEST", {
    asset: narration,
    voice: narration?.provider ?? "free-voice-fallback",
    wordsPerMinute: storyboard.wordsPerMinute,
    audioSynthesisRequired: !narration?.mimeType.startsWith("audio/"),
    costUsd: 0,
  });
  transitionProject({
    projectId,
    to: "RENDERING",
    reason: `Asset gate passed with ${assets.length} ready assets (${project.format})`,
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}
export async function renderVideoAction(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.state !== "RENDERING") throw new Error("Project is not ready to render");
  const a = listArtifacts(projectId).find((x) => x.artifactType === "STORYBOARD");
  if (!a) throw new Error("Storyboard not found");
  const render = renderDemoVideo(projectId, a.content as unknown as Storyboard, project.format);
  if (!render.qa.pass) throw new Error("Rendered video failed technical QA");
  transitionProject({
    projectId,
    to: "QA_REVIEW",
    reason: `MP4 rendered and passed ${Object.keys(render.qa.checks).length} technical checks (${project.format})`,
    idempotencyKey: randomUUID(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}
export async function buildPublishPackageAction(projectId:string){const project=getProject(projectId);if(!project||project.state!=="QA_REVIEW")throw new Error("Project is not awaiting QA");const topic=listTopics(projectId).find(t=>t.status==="APPROVED"),story=listArtifacts(projectId).find(a=>a.artifactType==="STORYBOARD"),render=listRenders(projectId)[0];if(!topic||!story||!render)throw new Error("Publishing inputs are incomplete");const claims=listClaims(projectId),grounded=claims.length>0&&claims.every(c=>c.supportStatus==="SUPPORTED"&&!!c.sourceId);const result=await buildPublishPackage(projectId,topic,story.content as unknown as Storyboard,listMediaAssets(projectId),render,grounded);if(result.issues.length)throw new Error(result.issues.join("; "));createArtifact(projectId,"SEO_PACKAGE",result.seo);createArtifact(projectId,"PUBLISH_PACKAGE",{zipUri:result.zipUri,thumbnailUris:result.thumbnailUris,checksum:result.checksum,qa:"PASSED"});transitionProject({projectId,to:"READY_TO_PUBLISH",reason:"Editorial QA passed and publishing ZIP created",idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/");}
export async function uploadPrivateAction(projectId:string,formData:FormData){const project=getProject(projectId);if(!project||project.state!=="READY_TO_PUBLISH")throw new Error("Project is not ready to upload");const seo=listArtifacts(projectId).find(a=>a.artifactType==="SEO_PACKAGE");if(!seo)throw new Error("SEO package missing");transitionProject({projectId,to:"PUBLISH_APPROVAL",reason:"Owner approved private upload",idempotencyKey:randomUUID()});transitionProject({projectId,to:"UPLOADING",reason:"Resumable upload started",idempotencyKey:randomUUID()});await uploadPrivate(projectId,seo.content as unknown as SeoPackage,{madeForKids:formData.get("madeForKids")==="true",containsSyntheticMedia:formData.get("containsSyntheticMedia")==="true"});savePublication(projectId,{mode:process.env.PUBLISH_PROVIDER==="youtube"?"youtube":"demo"});transitionProject({projectId,to:"UPLOADED_PRIVATE",reason:`Private ${process.env.PUBLISH_PROVIDER==="youtube"?"YouTube":"demo"} upload completed`,idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/");}
export async function collectAnalyticsAction(projectId:string,formData:FormData){const value=Number(formData.get("windowHours"));if(!ANALYTICS_WINDOWS.includes(value as AnalyticsWindow))throw new Error("Unsupported analytics window");const project=getProject(projectId);if(!project)throw new Error("Project not found");const permitted=["READY_TO_PUBLISH","UPLOADED_PRIVATE","SCHEDULED","PUBLISHED","ANALYZING"];if(!permitted.includes(project.state))throw new Error("Analytics becomes available after the publishing package is ready");const snapshot=saveAnalyticsSnapshot(await collectAnalytics(projectId,value as AnalyticsWindow));const snapshots=listAnalyticsSnapshots(projectId),latest=snapshots.at(-1)??snapshot;replaceProposedRecommendations(projectId,analyzePerformance(latest));if(project.state==="PUBLISHED")transitionProject({projectId,to:"ANALYZING",reason:`${value}h analytics snapshot collected`,idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/analytics");}
export async function decideRecommendationAction(projectId:string,recommendationId:string,formData:FormData){const decision=formData.get("decision");if(decision!=="APPROVED"&&decision!=="REJECTED")throw new Error("Invalid recommendation decision");decideRecommendation(projectId,recommendationId,decision);if(decision==="APPROVED")createExperiment(projectId,recommendationId,String(formData.get("hypothesis")??"Approved performance recommendation"),String(formData.get("variable")??"CONTENT"));revalidatePath(`/projects/${projectId}`);revalidatePath("/analytics");}
export async function createBackupAction(){const path=createDatabaseBackup();redirect(`/system?backup=${encodeURIComponent(path)}`);}
export async function selectThumbnailAction(projectId:string,formData:FormData){const selected=String(formData.get("thumbnail"));if(!/^thumbnail-[abc]\.svg$/.test(selected))throw new Error("Invalid thumbnail selection");savePublication(projectId,{selectedThumbnail:selected});revalidatePath(`/projects/${projectId}`)}
export async function schedulePublicationAction(projectId:string,formData:FormData){const project=getProject(projectId);if(!project||project.state!=="UPLOADED_PRIVATE")throw new Error("Only a private upload can be scheduled");await schedulePublication(projectId,String(formData.get("publishAt")));transitionProject({projectId,to:"SCHEDULED",reason:`Publication scheduled for ${formData.get("publishAt")}`,idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/")}
export async function publishNowAction(projectId:string){const project=getProject(projectId);if(!project||!(["UPLOADED_PRIVATE","SCHEDULED"] as string[]).includes(project.state))throw new Error("Project is not ready to publish");await publishNow(projectId);transitionProject({projectId,to:"PUBLISHED",reason:"Video publication confirmed",idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/")}
export async function reconcilePublicationAction(projectId:string){await reconcilePublication(projectId);revalidatePath(`/projects/${projectId}`)}
export async function collectAllAnalyticsAction(projectId:string){for(const windowHours of ANALYTICS_WINDOWS)saveAnalyticsSnapshot(await collectAnalytics(projectId,windowHours));const latest=listAnalyticsSnapshots(projectId).at(-1);if(latest)replaceProposedRecommendations(projectId,analyzePerformance(latest));const project=getProject(projectId);if(project?.state==="PUBLISHED")transitionProject({projectId,to:"ANALYZING",reason:"All analytics windows collected",idempotencyKey:randomUUID()});revalidatePath(`/projects/${projectId}`);revalidatePath("/analytics")}
