import { db } from "../src/infrastructure/database.ts";
import { generateLocalAssets } from "../src/application/asset-generator.ts";
import { renderDemoVideo } from "../src/application/video-renderer.ts";
import type { Storyboard } from "../src/domain/storyboard.ts";
import type { VideoProject } from "../src/domain/video-project.ts";

const projectId = process.argv[2];
if (!projectId) throw new Error("Usage: node --experimental-strip-types scripts/generate-and-render.ts <project-id>");

const project = db.prepare("SELECT * FROM video_projects WHERE id=?").get(projectId) as { video_format: string } | undefined;
if (!project) throw new Error("Project not found");

const row = db.prepare("SELECT content_json FROM artifacts WHERE project_id=? AND artifact_type='STORYBOARD' ORDER BY version DESC LIMIT 1").get(projectId) as { content_json: string } | undefined;
if (!row) throw new Error("Storyboard not found");

const storyboard = JSON.parse(row.content_json) as Storyboard;
const format = (project.video_format as VideoProject["format"]) ?? "LONG_FORM";

console.log(`[AI Media Engine] Generating high-resolution AI visuals for ${storyboard.scenes.length} scenes...`);
const assets = await generateLocalAssets(projectId, storyboard, format);
console.log(`[AI Media Engine] Successfully generated ${assets.length} assets.`);

console.log(`[Video Renderer] Rendering video with Ken Burns motion, text overlays, and audio...`);
const result = renderDemoVideo(projectId, storyboard, format);
console.log(`[Video Renderer] Render complete! Video URI: ${result.videoUri} (${result.durationSeconds}s, QA pass: ${result.qa.pass})`);
