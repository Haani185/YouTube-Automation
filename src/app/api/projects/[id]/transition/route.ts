import { transitionProjectSchema } from "@/domain/schemas";
import { transitionProject } from "@/infrastructure/project-repository";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = transitionProjectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid transition request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    return Response.json({ data: transitionProject({ projectId: id, ...parsed.data }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transition failed";
    return Response.json({ error: message }, { status: message === "Project not found" ? 404 : 409 });
  }
}
