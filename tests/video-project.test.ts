import assert from "node:assert/strict";
import test from "node:test";
import { assertTransition, canTransition } from "../src/domain/video-project.ts";
import { canRetryJob, nextArtifactVersion } from "../src/domain/control-center.ts";
import { calculateTopicScore, createContextualTopicDrafts } from "../src/domain/topic.ts";
import { researchGate } from "../src/domain/research.ts";
import { createRenderManifest, generateStoryboard, validateStoryboard } from "../src/domain/storyboard.ts";
import { assetCoverage, planAssets } from "../src/domain/assets.ts";
import {createSeoPackage,validatePublishing} from "../src/domain/publishing.ts";
import { analyzePerformance, validateSnapshot, type AnalyticsSnapshot } from "../src/domain/analytics.ts";
import { aggregateHealth, budgetHealth } from "../src/domain/operations.ts";
import { offlineResearchSource } from "../src/application/research-assistant.ts";
import { generateDeterministicScript, updateScriptDraft } from "../src/application/script-generator.ts";

test("allows the normal first-stage transition", () => {
  assert.equal(canTransition("DRAFT_IDEA", "TOPIC_REVIEW"), true);
});

test("blocks skipping approval and production stages", () => {
  assert.equal(canTransition("DRAFT_IDEA", "PUBLISHED"), false);
  assert.throws(() => assertTransition("DRAFT_IDEA", "PUBLISHED"), /Invalid project transition/);
});

test("allows a QA failure to route back to rendering", () => {
  assert.equal(canTransition("QA_REVIEW", "RENDERING"), true);
});

test("increments immutable artifact revisions", () => {
  assert.equal(nextArtifactVersion(null), 1);
  assert.equal(nextArtifactVersion(3), 4);
});

test("only retries failed jobs with attempts remaining", () => {
  assert.equal(canRetryJob("FAILED", 1, 3), true);
  assert.equal(canRetryJob("FAILED", 3, 3), false);
  assert.equal(canRetryJob("SUCCEEDED", 1, 3), false);
});

test("calculates the documented weighted topic score", () => {
  assert.equal(calculateTopicScore({ demand:100,audienceFit:80,competition:60,clickPotential:80,evergreen:70,freshness:50,businessValue:60 }), 77);
});
test("generates candidates from the selected project idea",()=>{const drafts=createContextualTopicDrafts("Nursery rhymes for kids","Parents of young children","Educational videos");assert.equal(drafts.length,5);assert.ok(drafts.every(draft=>draft.title.toLowerCase().includes("nursery rhymes for kids")));assert.ok(drafts.every(draft=>draft.rationale.includes("Nursery rhymes for kids")));});

test("blocks research with unsupported claims",()=>{
  const result=researchGate([{supportStatus:"UNSUPPORTED",riskLevel:"HIGH",sourceId:null}]);
  assert.equal(result.pass,false); assert.ok(result.reasons.length>=2);
});

test("passes source-backed supported claims",()=>{
  assert.deepEqual(researchGate([{supportStatus:"SUPPORTED",riskLevel:"HIGH",sourceId:"source-id"}]),{pass:true,reasons:[]});
});

test("generates contiguous timed scenes and a matching manifest",()=>{
  const storyboard=generateStoryboard({title:"Test",estimatedMinutes:1,wordCount:12,sections:[{heading:"Hook",narration:"One short sentence. Another useful sentence.",claimIds:[]}]});
  assert.equal(storyboard.scenes.length,2); assert.deepEqual(validateStoryboard(storyboard),[]);
  const manifest=createRenderManifest(storyboard); assert.equal(manifest.totalDurationSeconds,storyboard.totalDurationSeconds); assert.equal(manifest.scenes[1].order,2);
});

test("requires one ready visual per scene and narration",()=>{
  const storyboard=generateStoryboard({title:"Test",estimatedMinutes:1,wordCount:4,sections:[{heading:"Hook",narration:"A useful opening sentence.",claimIds:[]}]});
  assert.equal(planAssets(storyboard).length,2);
  assert.equal(assetCoverage(["scene-001"],[{sceneId:"scene-001",assetKind:"VISUAL",status:"READY"}]).pass,false);
  assert.equal(assetCoverage(["scene-001"],[{sceneId:"scene-001",assetKind:"VISUAL",status:"READY"},{sceneId:null,assetKind:"NARRATION",status:"READY"}]).pass,true);
});

test("allows successful rendering to enter QA review",()=>{assert.equal(canTransition("RENDERING","QA_REVIEW"),true);});
test("records private upload before publication",()=>{assert.equal(canTransition("UPLOADING","UPLOADED_PRIVATE"),true);assert.equal(canTransition("UPLOADED_PRIVATE","PUBLISHED"),true);});

test("blocks publishing without three thumbnails",()=>{const seo=createSeoPackage({id:"x",title:"A Valid Video Title",audience:"Owners",intent:"Learn",primaryKeyword:"automation",hook:"A useful hook",rationale:"Relevant",scores:{demand:80,audienceFit:80,competition:80,clickPotential:80,evergreen:80,freshness:80,businessValue:80},totalScore:80,status:"APPROVED",provider:"demo",createdAt:""},{title:"Test",wordsPerMinute:145,totalDurationSeconds:10,scenes:[{id:"scene-001",order:1,durationSeconds:10,narration:"Text",visualType:"AI_IMAGE",visualPrompt:"Prompt",overlay:"INTRO",transition:"CUT",claimIds:[]}]});assert.ok(validatePublishing({seo,hasVideo:true,hasCaptions:true,thumbnailCount:2,technicalQa:true,claimsGrounded:true}).includes("Three thumbnail candidates required"));});
test("shortens generated YouTube titles to 100 characters",()=>{const seo=createSeoPackage({id:"x",title:"A very long generated video title ".repeat(5),audience:"Owners",intent:"Learn",primaryKeyword:"automation",hook:"Hook",rationale:"Relevant",scores:{demand:80,audienceFit:80,competition:80,clickPotential:80,evergreen:80,freshness:80,businessValue:80},totalScore:80,status:"APPROVED",provider:"demo",createdAt:""},{title:"Test",wordsPerMinute:145,totalDurationSeconds:10,scenes:[{id:"scene-001",order:1,durationSeconds:10,narration:"Text",visualType:"AI_IMAGE",visualPrompt:"Prompt",overlay:"INTRO",transition:"CUT",claimIds:[]}]});assert.ok(seo.titles.every(title=>title.length<=100));assert.equal(validatePublishing({seo,hasVideo:true,hasCaptions:true,thumbnailCount:3,technicalQa:true,claimsGrounded:true}).length,0);});

const snapshot=(overrides:Partial<AnalyticsSnapshot>={}):AnalyticsSnapshot=>({id:"snapshot",projectId:"project",youtubeVideoId:null,windowHours:72,capturedAt:"2026-01-01T00:00:00Z",source:"demo",views:1200,estimatedMinutesWatched:4000,averageViewDuration:200,averageViewPercentage:48,subscribersGained:8,likes:50,comments:5,impressions:30000,impressionCtr:3.2,...overrides});
test("diagnoses healthy retention with weak packaging",()=>{const result=analyzePerformance(snapshot());assert.equal(result[0].category,"PACKAGING");assert.equal(result[0].confidence,"HIGH");});
test("diagnoses promise mismatch when clicks are strong and retention is weak",()=>{const result=analyzePerformance(snapshot({impressionCtr:6.2,averageViewPercentage:25}));assert.equal(result[0].category,"RETENTION");assert.match(result[0].finding,/leave earlier/);});
test("rejects impossible analytics percentages",()=>{const {id,capturedAt,...input}=snapshot({averageViewPercentage:101});void id;void capturedAt;assert.throws(()=>validateSnapshot(input),/between 0 and 100/);});
test("warns before the monthly budget is exhausted",()=>{assert.equal(budgetHealth(79,100),"HEALTHY");assert.equal(budgetHealth(80,100),"WARNING");assert.equal(budgetHealth(100,100),"BLOCKED");});
test("overall health reports the most severe check",()=>{assert.equal(aggregateHealth(["HEALTHY","WARNING"]),"WARNING");assert.equal(aggregateHealth(["WARNING","BLOCKED"]),"BLOCKED");});
test("provides a useful offline research source when network lookup fails",()=>{const source=offlineResearchSource({id:"topic",title:"Nursery rhymes for young children",audience:"Parents",intent:"Learn",primaryKeyword:"nursery rhyme",hook:"",rationale:"",scores:{demand:1,audienceFit:1,competition:1,clickPotential:1,evergreen:1,freshness:1,businessValue:1},totalScore:1,status:"APPROVED",provider:"demo",createdAt:""});assert.equal(source.publisher,"Encyclopaedia Britannica");assert.match(source.notes,/small children/i);});

test("supports 9:16 Shorts and 16:9 Long-Form canvas manifests",()=>{
  const storyboard=generateStoryboard({title:"Test",estimatedMinutes:1,wordCount:10,sections:[{heading:"Hook",narration:"A fast sentence for shorts.",claimIds:[]}]},145,"SHORT");
  const shortManifest=createRenderManifest(storyboard,"SHORT");
  assert.equal(shortManifest.canvas.width,1080);
  assert.equal(shortManifest.canvas.height,1920);

  const longManifest=createRenderManifest(storyboard,"LONG_FORM");
  assert.equal(longManifest.canvas.width,1920);
  assert.equal(longManifest.canvas.height,1080);
});

test("scales script word count and sections for target duration",()=>{
  const topic={id:"t1",title:"AI Workflows",audience:"Engineers",intent:"Learn",primaryKeyword:"ai",hook:"AI is accelerating.",rationale:"Useful",scores:{demand:90,audienceFit:90,competition:50,clickPotential:80,evergreen:80,freshness:80,businessValue:80},totalScore:80,status:"APPROVED" as const,provider:"demo",createdAt:""};
  const claims=[{id:"c1",claimText:"AI boosts developer velocity by 25%",supportStatus:"SUPPORTED" as const,riskLevel:"LOW" as const,sourceId:"s1",evidence:"Empirical studies show 25% speedup",asOfDate:"2026-01-01",createdAt:"2026-01-01"}];
  const sources=[{id:"s1",title:"Developer Study",url:"https://example.com/study",publisher:"Tech Research",publishedAt:"2026-01-01",accessedAt:"2026-01-01",trustLevel:"HIGH" as const,notes:"Benchmark study"}];
  
  const shortScript=generateDeterministicScript(topic,claims,sources,{format:"SHORT",targetDurationMinutes:1});
  assert.equal(shortScript.format,"SHORT");
  assert.equal(shortScript.sections.length,3);

  const longScript=generateDeterministicScript(topic,claims,sources,{format:"LONG_FORM",targetDurationMinutes:8});
  assert.equal(longScript.format,"LONG_FORM");
  assert.ok(longScript.sections.length>=5);
  assert.ok(longScript.wordCount>shortScript.wordCount);
});

test("updates script draft sections and recalculates word count",()=>{
  const initial={title:"Test",estimatedMinutes:1,wordCount:2,sections:[{heading:"Intro",narration:"Original sentence.",claimIds:[]}]};
  const updated=updateScriptDraft(initial,0,"New Intro","This is a much longer and more detailed revised sentence.");
  assert.equal(updated.sections[0].heading,"New Intro");
  assert.ok(updated.wordCount>initial.wordCount);
});
