import type { ChannelProfile } from "@/domain/control-center";
import { createContextualTopicDrafts, topicBatchSchema, type TopicDraft } from "@/domain/topic";

export type TopicGenerator = { provider: string; generate(profile: ChannelProfile,workingIdea:string): Promise<TopicDraft[]> };

class DemoTopicGenerator implements TopicGenerator {
  provider="demo";
  async generate(profile:ChannelProfile,workingIdea:string):Promise<TopicDraft[]> {
    return createContextualTopicDrafts(workingIdea,profile.targetAudience,profile.niche);
  }
}

class OpenAITopicGenerator implements TopicGenerator {
  provider="openai";
  constructor(private key:string, private model:string) {}
  async generate(profile:ChannelProfile,workingIdea:string):Promise<TopicDraft[]> {
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${this.key}`,"Content-Type":"application/json"},body:JSON.stringify({model:this.model,store:false,instructions:"You are a YouTube topic strategist. The working idea is authoritative: every candidate must directly develop that subject. Return evidence-conscious candidates. Scores are hypotheses from 0-100, not fabricated measurements. Avoid claims of live trend data.",input:JSON.stringify({workingIdea,channelProfile:profile}),text:{format:{type:"json_schema",name:"topic_candidates",strict:true,schema:{type:"object",additionalProperties:false,required:["candidates"],properties:{candidates:{type:"array",minItems:5,maxItems:5,items:{type:"object",additionalProperties:false,required:["title","audience","intent","primaryKeyword","hook","rationale","scores"],properties:{title:{type:"string"},audience:{type:"string"},intent:{type:"string"},primaryKeyword:{type:"string"},hook:{type:"string"},rationale:{type:"string"},scores:{type:"object",additionalProperties:false,required:["demand","audienceFit","competition","clickPotential","evergreen","freshness","businessValue"],properties:{demand:{type:"integer"},audienceFit:{type:"integer"},competition:{type:"integer"},clickPotential:{type:"integer"},evergreen:{type:"integer"},freshness:{type:"integer"},businessValue:{type:"integer"}}}}}}}}}}})});
    if(!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    const body=await response.json() as {output?:Array<{content?:Array<{type:string;text?:string}>}>};
    const text=body.output?.flatMap(o=>o.content??[]).find(c=>c.type==="output_text")?.text;
    if(!text) throw new Error("OpenAI returned no structured output");
    return topicBatchSchema.parse(JSON.parse(text)).candidates;
  }
}

export function getTopicGenerator():TopicGenerator {
  if(process.env.AI_PROVIDER==="openai") {
    if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
    return new OpenAITopicGenerator(process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL??"gpt-5.4-mini");
  }
  return new DemoTopicGenerator();
}
