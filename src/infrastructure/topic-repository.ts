import { randomUUID } from "node:crypto";
import { db } from "./database";
import { calculateTopicScore, type TopicDraft } from "@/domain/topic";

export type TopicCandidate=TopicDraft & {id:string;totalScore:number;status:"PROPOSED"|"APPROVED"|"REJECTED";provider:string;createdAt:string};

export function replaceProposedTopics(projectId:string,drafts:TopicDraft[],provider:string):TopicCandidate[]{
  const now=new Date().toISOString(); db.exec("BEGIN IMMEDIATE");
  try { db.prepare("UPDATE topic_candidates SET status='REJECTED' WHERE project_id=? AND status IN ('PROPOSED','APPROVED')").run(projectId);
    for(const d of drafts){const s=d.scores;db.prepare("INSERT INTO topic_candidates VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),projectId,d.title,d.audience,d.intent,d.primaryKeyword,d.hook,d.rationale,s.demand,s.audienceFit,s.competition,s.clickPotential,s.evergreen,s.freshness,s.businessValue,calculateTopicScore(s),"PROPOSED",provider,now);} db.exec("COMMIT");
  }catch(e){db.exec("ROLLBACK");throw e;} return listTopics(projectId);
}
export function listTopics(projectId:string):TopicCandidate[]{return (db.prepare("SELECT * FROM topic_candidates WHERE project_id=? ORDER BY total_score DESC").all(projectId) as Record<string,unknown>[]).map(r=>({id:r.id as string,title:r.title as string,audience:r.audience as string,intent:r.intent as string,primaryKeyword:r.primary_keyword as string,hook:r.hook as string,rationale:r.rationale as string,scores:{demand:r.demand as number,audienceFit:r.audience_fit as number,competition:r.competition as number,clickPotential:r.click_potential as number,evergreen:r.evergreen as number,freshness:r.freshness as number,businessValue:r.business_value as number},totalScore:r.total_score as number,status:r.status as TopicCandidate["status"],provider:r.provider as string,createdAt:r.created_at as string}));}
export function approveTopic(projectId:string,topicId:string):TopicCandidate{db.exec("BEGIN IMMEDIATE");try{const changed=db.prepare("UPDATE topic_candidates SET status=CASE WHEN id=? THEN 'APPROVED' ELSE 'REJECTED' END WHERE project_id=?").run(topicId,projectId);if(changed.changes<1)throw new Error("Topic not found");db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}const topic=listTopics(projectId).find(t=>t.id===topicId);if(!topic)throw new Error("Topic not found");return topic;}
