import type { ScriptDraft } from "@/application/script-generator";
import type { VideoFormat } from "./video-project";

export type VisualType="AI_IMAGE"|"STOCK_VIDEO"|"INFOGRAPHIC"|"TEXT_MOTION"|"SCREEN_CAPTURE";
export type StoryboardScene={id:string;order:number;durationSeconds:number;narration:string;visualType:VisualType;visualPrompt:string;overlay:string;transition:"CUT"|"DISSOLVE"|"PUSH";claimIds:string[]};
export type Storyboard={title:string;scenes:StoryboardScene[];totalDurationSeconds:number;wordsPerMinute:number;format?:VideoFormat};
export type RenderManifest={version:1;canvas:{width:number;height:number;fps:30};videoCodec:"h264";audioCodec:"aac";scenes:Array<{sceneId:string;order:number;durationSeconds:number}>;totalDurationSeconds:number;captionTrack:"AUTO_FROM_NARRATION"};

function visualTypeFor(heading:string,hasClaims:boolean):VisualType {
  if(hasClaims)return "INFOGRAPHIC";
  if(/hook/i.test(heading))return "TEXT_MOTION";
  if(/takeaway/i.test(heading))return "SCREEN_CAPTURE";
  return "AI_IMAGE";
}

export function generateStoryboard(script:ScriptDraft,wordsPerMinute=145,format:VideoFormat="LONG_FORM"):Storyboard {
  let order=0;
  const scenes=script.sections.flatMap(section=>{
    const sentences=section.narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean)??[];
    return sentences.map((narration,index)=>{
      order+=1; const words=narration.split(/\s+/).filter(Boolean).length;
      const minDuration=format==="SHORT"?2:3;
      const durationSeconds=Math.max(minDuration,Math.round(words/wordsPerMinute*60*10)/10);
      const visualType=visualTypeFor(section.heading,section.claimIds.length>0);
      return {id:`scene-${String(order).padStart(3,"0")}`,order,durationSeconds,narration,visualType,visualPrompt:`${visualType.replaceAll("_"," ").toLowerCase()} for ${section.heading}: ${narration}`,overlay:index===0?section.heading.toUpperCase():"",transition:order===1?"CUT" as const:"DISSOLVE" as const,claimIds:section.claimIds};
    });
  });
  return {title:script.title,scenes,totalDurationSeconds:Math.round(scenes.reduce((sum,s)=>sum+s.durationSeconds,0)*10)/10,wordsPerMinute,format};
}

export function createRenderManifest(storyboard:Storyboard,format:VideoFormat=storyboard.format??"LONG_FORM"):RenderManifest {
  if(!storyboard.scenes.length)throw new Error("Storyboard requires at least one scene");
  const isShort=format==="SHORT";
  return {version:1,canvas:{width:isShort?1080:1920,height:isShort?1920:1080,fps:30},videoCodec:"h264",audioCodec:"aac",scenes:storyboard.scenes.map(s=>({sceneId:s.id,order:s.order,durationSeconds:s.durationSeconds})),totalDurationSeconds:storyboard.totalDurationSeconds,captionTrack:"AUTO_FROM_NARRATION"};
}

export function validateStoryboard(storyboard:Storyboard):string[]{
  const issues:string[]=[];
  if(!storyboard.scenes.length)issues.push("No scenes generated");
  if(storyboard.scenes.some((s,i)=>s.order!==i+1))issues.push("Scene order is not contiguous");
  if(storyboard.scenes.some(s=>s.durationSeconds<3))issues.push("Every scene must last at least three seconds");
  const sum=Math.round(storyboard.scenes.reduce((n,s)=>n+s.durationSeconds,0)*10)/10;
  if(Math.abs(sum-storyboard.totalDurationSeconds)>.1)issues.push("Scene timing does not reconcile with total duration");
  return issues;
}
