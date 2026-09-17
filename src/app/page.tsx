import Link from "next/link";
import { createProjectAction } from "./actions";
import { listProjects } from "@/infrastructure/project-repository";
import { journeySteps, workflowGuide } from "@/domain/workflow-guide";
import {getChannelProfile} from "@/infrastructure/control-center-repository";
import {recommendChannelIdeas} from "@/application/idea-recommendations";
import {DeleteProjectButton} from "./DeleteProjectButton";
import {connectionStatus} from "@/infrastructure/youtube-auth";
import {safeLiveYouTubeChannel} from "@/application/youtube-channel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = listProjects();
  const profile=getChannelProfile(),ideas=recommendChannelIdeas(profile);
  const connected=connectionStatus().connected,live=connected?await safeLiveYouTubeChannel():{data:null,error:null};
  return (
    <div className="stack-xl">
      <section className="hero">
        <div>
          <p className="eyebrow">Your video workspace</p>
          <h1>Turn an idea into a finished YouTube video.</h1>
          <p className="lede">The platform guides you through writing, production, publishing, and improvement—one clear step at a time.</p>
        </div>
        <div className="metric"><strong>{projects.length}</strong><span>Projects</span></div>
      </section>

      {live.data?<section className="channel-strip"><div><span className="live-dot"/>Live YouTube channel</div><strong>{live.data.title}</strong><span>{live.data.subscribers.toLocaleString()} subscribers</span><span>{live.data.last28Days.views.toLocaleString()} views in 28 days</span><Link href="/analytics">View live analytics →</Link></section>:<section className="channel-strip muted"><div>YouTube is not connected</div><span>Connect your channel to display live performance throughout the platform.</span><Link href="/settings">Connect YouTube →</Link></section>}

      <section className="journey"><div className="section-heading"><h2>How it works</h2><span>5 simple steps</span></div><div className="journey-steps">{journeySteps.map((step,index)=><div key={step}><span>{index+1}</span><strong>{step}</strong></div>)}</div></section>

      <section className="grid-two">
        <div className="panel">
          <div className="section-heading"><h2>Projects</h2><span>{projects.length} total</span></div>
          <div className="project-list">
            {projects.length === 0 ? <p className="empty">No videos yet. Use the form to start your first one.</p> : projects.map((project) => {
              const guide=workflowGuide(project.state); return (
              <div className="project-row" key={project.id}>
                <Link className="project-main" href={`/projects/${project.id}`}>
                  <div>
                    <strong>{project.title}</strong>
                    <span>
                      <span className={`format-pill ${project.format === "SHORT" ? "short" : "long"}`}>
                        {project.format === "SHORT" ? "📱 9:16 Short" : "🎥 16:9"}
                      </span>
                      {" "}Next: {guide.title} · {project.targetDurationMinutes} min
                    </span>
                    <div className="mini-progress"><i style={{width:`${(guide.journey+1)/journeySteps.length*100}%`}}/></div>
                  </div>
                  <span className="status">{guide.label}</span>
                </Link>
                <DeleteProjectButton projectId={project.id} projectTitle={project.title}/>
              </div>
            )})}
          </div>
        </div>

        <form className="panel form" action={createProjectAction}>
          <div className="section-heading"><h2>Start a new video</h2><span>Step 1</span></div>
          <p className="muted">Enter a rough idea. It does not need to be a polished YouTube title yet.</p>
          <label>What should the video be about?<input name="title" minLength={3} maxLength={120} required placeholder="AI jobs for fresh graduates" /></label>
          <label>Video format
            <div className="format-selector">
              <label className="format-option">
                <input type="radio" name="format" value="LONG_FORM" defaultChecked />
                <span>🎥 16:9 Long-Form (Full HD)</span>
              </label>
              <label className="format-option">
                <input type="radio" name="format" value="SHORT" />
                <span>📱 9:16 Shorts (Vertical)</span>
              </label>
            </div>
          </label>
          <div className="form-row">
            <label>Language<input name="language" defaultValue="English" required /></label>
            <label>Target minutes<input name="targetDurationMinutes" type="number" defaultValue="8" min="1" max="180" required /></label>
          </div>
          <button type="submit">Start guided workflow</button>
        </form>
      </section>

      <section className="panel idea-recommendations">
        <div className="section-heading"><div><p className="eyebrow">Based on your channel setup</p><h2>5 video ideas with strong viral potential</h2></div><Link href="/settings">Edit channel setup</Link></div>
        <p className="muted">Tailored for <strong>{profile.targetAudience}</strong> in <strong>{profile.niche}</strong>. Scores are strategy estimates, not claimed live view data.</p>
        <div className="idea-grid">{ideas.map((idea,index)=><article className="idea-option" key={idea.title}><span className="idea-number">{index+1}</span><div><small>{idea.format}</small><h3>{idea.title}</h3><p>{idea.hook}</p><span>{idea.whyItCanWork}</span></div><form action={createProjectAction}><input type="hidden" name="title" value={idea.title}/><input type="hidden" name="language" value={profile.language}/><input type="hidden" name="targetDurationMinutes" value={idea.format.toLowerCase().includes("short") ? "1" : String(profile.defaultDurationMinutes)}/><input type="hidden" name="format" value={idea.format.toLowerCase().includes("short") ? "SHORT" : "LONG_FORM"}/><button type="submit">Use this idea</button></form></article>)}</div>
      </section>
    </div>
  );
}
