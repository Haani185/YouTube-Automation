import { listSources } from "@/infrastructure/research-repository";
import { claimFromSource } from "@/application/research-assistant";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params,sourceId=new URL(request.url).searchParams.get("sourceId"),source=listSources(id).find(item=>item.id===sourceId);if(!source)return Response.json({error:"Select a saved source first"},{status:400});return Response.json(claimFromSource(source))}catch(error){return Response.json({error:error instanceof Error?error.message:"Could not generate a claim draft"},{status:500})}}
