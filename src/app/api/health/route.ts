import { operationsReport } from "@/infrastructure/operations";
export const dynamic="force-dynamic";
export function GET(){const report=operationsReport();return Response.json(report,{status:report.level==="BLOCKED"?503:200,headers:{"Cache-Control":"no-store"}})}
