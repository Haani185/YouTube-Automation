import { getProject, listProjectEvents } from "@/infrastructure/project-repository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!getProject(id)) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ data: listProjectEvents(id) });
}
