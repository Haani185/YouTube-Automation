import { createProjectSchema } from "@/domain/schemas";
import { createProject, listProjects } from "@/infrastructure/project-repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ data: listProjects() });
}

export async function POST(request: Request) {
  const parsed = createProjectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid project", issues: parsed.error.issues }, { status: 400 });
  }
  return Response.json({ data: createProject(parsed.data) }, { status: 201 });
}
