import type { TopicCandidate } from "@/infrastructure/topic-repository";
import type { ResearchSource } from "@/infrastructure/research-repository";

type WikiPage={title:string;extract?:string;fullurl?:string};
type WikiResponse={query?:{pages?:Record<string,WikiPage>}};

const fallbacks=[
  {terms:["nursery","rhyme","children","kids","learning","play"],title:"Nursery rhyme",url:"https://www.britannica.com/art/nursery-rhyme",publisher:"Encyclopaedia Britannica",notes:"A nursery rhyme is a verse customarily told or sung to small children. The source provides historical and literary context for planning age-appropriate nursery-rhyme content."},
  {terms:["job","career","graduate","employment","work"],title:"Employment Projections",url:"https://www.bls.gov/emp/",publisher:"U.S. Bureau of Labor Statistics",notes:"The U.S. Bureau of Labor Statistics publishes employment projections covering occupations, industries, the labor force, and the economy. The projections provide a public evidence base for career and employment topics."},
  {terms:["ai","automation","artificial intelligence","workflow","business"],title:"AI Risk Management Framework",url:"https://www.nist.gov/itl/ai-risk-management-framework",publisher:"National Institute of Standards and Technology",notes:"The NIST AI Risk Management Framework is intended for voluntary use and is designed to help organizations manage risks from artificial intelligence systems. It provides a structured reference for responsible AI adoption."},
] as const;

export function offlineResearchSource(topic:TopicCandidate):Omit<ResearchSource,"id"|"accessedAt">{
  const text=`${topic.title} ${topic.primaryKeyword}`.toLowerCase();
  const match=fallbacks.find(item=>item.terms.some(term=>text.includes(term)))??fallbacks[2];
  return{title:match.title,url:match.url,publisher:match.publisher,publishedAt:null,trustLevel:"HIGH",notes:match.notes};
}

export async function findResearchSource(topic:TopicCandidate):Promise<Omit<ResearchSource,"id"|"accessedAt">>{
  const query=[topic.primaryKeyword,topic.title].filter(Boolean).join(" ");
  const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrlimit:"5",prop:"extracts|info",inprop:"url",exintro:"1",explaintext:"1",format:"json",origin:"*"});
  try{
    const response=await fetch(`https://en.wikipedia.org/w/api.php?${params}`,{headers:{"User-Agent":"YouTubeAIManager/0.1 research-assistant"},cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!response.ok)return offlineResearchSource(topic);
    const data=await response.json() as WikiResponse;
    const pages=Object.values(data.query?.pages??{}).filter(page=>page.extract&&page.fullurl);
    const page=pages.find(item=>!item.extract!.toLowerCase().includes("may refer to"))??pages[0];
    if(!page?.extract||!page.fullurl)return offlineResearchSource(topic);
    return{title:page.title,url:page.fullurl,publisher:"Wikipedia",publishedAt:null,trustLevel:"MEDIUM",notes:page.extract.slice(0,5000)};
  }catch{return offlineResearchSource(topic)}
}

export function claimFromSource(source:ResearchSource){
  const sentences=source.notes.match(/[^.!?]+[.!?]+/g)??[source.notes];
  const claim=(sentences.find(sentence=>sentence.trim().length>=20)??source.notes).trim().slice(0,1000);
  if(claim.length<5)throw new Error("The selected source does not contain enough evidence to create a claim");
  return{claimText:claim,sourceId:source.id,supportStatus:"SUPPORTED" as const,riskLevel:"LOW" as const,evidence:`Generated from the saved ${source.publisher} summary: ${claim}`.slice(0,1500),asOfDate:new Date().toISOString().slice(0,10)};
}
