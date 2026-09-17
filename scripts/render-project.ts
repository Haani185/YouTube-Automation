import { db } from "../src/infrastructure/database.ts";
import { renderDemoVideo } from "../src/application/video-renderer.ts";
import type { Storyboard } from "../src/domain/storyboard.ts";

const projectId=process.argv[2];
if(!projectId)throw new Error("Usage: node --experimental-strip-types scripts/render-project.ts <project-id>");
const row=db.prepare("SELECT content_json FROM artifacts WHERE project_id=? AND artifact_type='STORYBOARD' ORDER BY version DESC LIMIT 1").get(projectId) as {content_json:string}|undefined;
if(!row)throw new Error("Storyboard not found");
const result=renderDemoVideo(projectId,JSON.parse(row.content_json) as Storyboard);
console.log(JSON.stringify({videoUri:result.videoUri,durationSeconds:result.durationSeconds,qa:result.qa},null,2));
