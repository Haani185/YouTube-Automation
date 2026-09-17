import { z } from "zod";

export const topicDraftSchema = z.object({
  title: z.string().min(5).max(120), audience: z.string().min(3).max(200),
  intent: z.string().min(2).max(100), primaryKeyword: z.string().min(2).max(100),
  hook: z.string().min(5).max(300), rationale: z.string().min(5).max(500),
  scores: z.object({ demand:z.number().int().min(0).max(100), audienceFit:z.number().int().min(0).max(100), competition:z.number().int().min(0).max(100), clickPotential:z.number().int().min(0).max(100), evergreen:z.number().int().min(0).max(100), freshness:z.number().int().min(0).max(100), businessValue:z.number().int().min(0).max(100) }),
});
export const topicBatchSchema = z.object({ candidates: z.array(topicDraftSchema).min(3).max(10) });
export type TopicDraft = z.infer<typeof topicDraftSchema>;

export function calculateTopicScore(s: TopicDraft["scores"]): number {
  return Math.round((s.demand*.25+s.audienceFit*.20+s.competition*.15+s.clickPotential*.15+s.evergreen*.10+s.freshness*.10+s.businessValue*.05)*10)/10;
}

export function createContextualTopicDrafts(workingIdea:string,audience:string,niche:string):TopicDraft[]{
  const subject=workingIdea.trim().replace(/[.!?]+$/g,"");
  const keyword=subject.toLowerCase();
  const concepts=[
    {title:`${subject}: A Complete Beginner's Guide`,intent:"Learn the fundamentals",hook:`Everything you need to understand ${keyword} before you begin.`},
    {title:`How to Get Started With ${subject} in 5 Simple Steps`,intent:"Follow a practical process",hook:`Turn ${keyword} into a clear five-step plan you can use today.`},
    {title:`7 Common ${subject} Mistakes and How to Avoid Them`,intent:"Avoid common mistakes",hook:`Most beginners make the same avoidable mistakes with ${keyword}.`},
    {title:`The Practical ${subject} Checklist for Beginners`,intent:"Use an actionable checklist",hook:`Use this checklist to make ${keyword} simpler, safer, and easier to finish.`},
    {title:`${subject}: What Actually Works and What Does Not`,intent:"Compare effective approaches",hook:`Separate useful advice about ${keyword} from the ideas that waste time.`},
  ];
  return concepts.map((item,index)=>({title:item.title.slice(0,120),audience,intent:item.intent,primaryKeyword:keyword.slice(0,100),hook:item.hook,rationale:`Directly develops the selected idea “${subject}” for ${audience} within the channel focus: ${niche}.`,scores:{demand:82-index*2,audienceFit:94-index,competition:68+index*2,clickPotential:88-index,evergreen:84+index,freshness:72+index,businessValue:70-index}}));
}
