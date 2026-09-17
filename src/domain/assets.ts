import type { Storyboard } from "./storyboard";

export type AssetRequirement={sceneId:string|null;kind:"VISUAL"|"NARRATION";provider:string;prompt:string;license:string;estimatedCostUsd:number};
export function planAssets(storyboard:Storyboard):AssetRequirement[]{
  return [
    ...storyboard.scenes.map(s=>({sceneId:s.id,kind:"VISUAL" as const,provider:"local-svg",prompt:s.visualPrompt,license:"SELF_GENERATED",estimatedCostUsd:0})),
    {sceneId:null,kind:"NARRATION" as const,provider:"windows-offline-tts",prompt:storyboard.scenes.map(s=>s.narration).join(" "),license:"SELF_GENERATED",estimatedCostUsd:0},
  ];
}
export function assetCoverage(sceneIds:string[],assets:Array<{sceneId:string|null;assetKind:string;status:string}>):{pass:boolean;missing:string[];hasNarration:boolean}{
  const ready=new Set(assets.filter(a=>a.assetKind==="VISUAL"&&a.status==="READY").map(a=>a.sceneId));
  const missing=sceneIds.filter(id=>!ready.has(id)); const hasNarration=assets.some(a=>a.assetKind==="NARRATION"&&a.status==="READY");
  return{pass:missing.length===0&&hasNarration,missing,hasNarration};
}
