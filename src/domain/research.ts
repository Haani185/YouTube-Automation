import { z } from "zod";

export const sourceInputSchema=z.object({title:z.string().trim().min(3).max(200),url:z.url(),publisher:z.string().trim().min(2).max(120),publishedAt:z.string().nullable().optional(),trustLevel:z.enum(["PRIMARY","HIGH","MEDIUM","LOW"]),notes:z.string().trim().min(3).max(1000)});
export const claimInputSchema=z.object({claimText:z.string().trim().min(5).max(1000),sourceId:z.string().uuid().nullable().optional(),supportStatus:z.enum(["SUPPORTED","PARTIAL","UNSUPPORTED","STALE"]),riskLevel:z.enum(["LOW","MEDIUM","HIGH"]),evidence:z.string().trim().min(3).max(1500),asOfDate:z.string().nullable().optional()});

export function researchGate(claims:Array<{supportStatus:string;riskLevel:string;sourceId:string|null}>):{pass:boolean;reasons:string[]} {
  const reasons:string[]=[];
  if(!claims.length) reasons.push("At least one claim is required");
  if(claims.some(c=>c.supportStatus==="UNSUPPORTED"||c.supportStatus==="STALE")) reasons.push("Unsupported or stale claims must be resolved");
  if(claims.some(c=>c.supportStatus==="SUPPORTED"&&!c.sourceId)) reasons.push("Supported claims must reference a source");
  if(claims.some(c=>c.riskLevel==="HIGH"&&c.supportStatus!=="SUPPORTED")) reasons.push("High-risk claims require full support");
  return {pass:reasons.length===0,reasons};
}
