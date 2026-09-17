import { getProject } from "@/infrastructure/project-repository";
import { listTopics } from "@/infrastructure/topic-repository";
import { findResearchSource } from "@/application/research-assistant";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params,project=getProject(id);if(!project)return Response.json({error:"Project not found"},{status:404});const topic=listTopics(id).find(item=>item.status==="APPROVED");if(!topic)return Response.json({error:"Approve a topic first"},{status:400});return Response.json(await findResearchSource(topic))}catch(error){return Response.json({error:error instanceof Error?error.message:"Could not generate a source draft"},{status:500})}}
