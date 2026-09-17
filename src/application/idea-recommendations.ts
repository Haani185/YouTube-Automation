import type {ChannelProfile} from "@/domain/control-center";

export type RecommendedIdea={title:string;hook:string;whyItCanWork:string;format:string};

const clean=(value:string)=>value.trim().replace(/\s+/g," ");

export function recommendChannelIdeas(profile:ChannelProfile):RecommendedIdea[]{
  const niche=clean(profile.niche),audience=clean(profile.targetAudience),tone=clean(profile.tone);
  return [
    {title:`7 ${niche} mistakes ${audience} should avoid`,hook:"Open with the most expensive or frustrating mistake, then reveal the fix.",whyItCanWork:"Numbered warnings combine curiosity, clear stakes, and practical value.",format:"Mistakes and fixes"},
    {title:`I tested 5 ${niche} methods—here is what actually worked`,hook:"Show the final result first, then compare every method with the same test.",whyItCanWork:"A real comparison creates proof, retention, and a strong winner reveal.",format:"Test and comparison"},
    {title:`The beginner’s step-by-step guide to ${niche}`,hook:`Promise one useful outcome for ${audience} without assuming prior knowledge.`,whyItCanWork:"Search-friendly beginner guides can earn long-term discovery and trust.",format:"Evergreen tutorial"},
    {title:`Before you spend money on ${niche}, watch this`,hook:"Contrast the popular choice with a simpler free or low-risk starting point.",whyItCanWork:"Purchase anxiety and loss avoidance create a clear reason to click now.",format:"Buyer guidance"},
    {title:`I built a complete ${niche} workflow in 30 minutes`,hook:"Start a visible timer and define exactly what will be completed by the end.",whyItCanWork:`A concrete challenge gives ${audience} a story, proof, and a satisfying payoff.`,format:`Challenge · ${tone}`},
  ];
}
