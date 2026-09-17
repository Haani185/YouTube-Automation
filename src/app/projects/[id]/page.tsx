import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProject, listProjectEvents } from "@/infrastructure/project-repository";
import { addClaimAction, addResearchSourceAction, approveResearchAction, approveScriptAction, approveTopicAction, buildPublishPackageAction, collectAnalyticsAction, createDraftArtifactAction, createJobAction, decideRecommendationAction, generateAssetsAction, generateScriptAction, generateStoryboardAction, generateTopicsAction, publishNowAction, reconcilePublicationAction, recordApprovalAction, renderVideoAction, restartTopicSelectionAction, runNextJobAction, schedulePublicationAction, selectThumbnailAction, submitResearchForReviewAction, submitTopicForReview, uploadPrivateAction } from "../../actions";
import { listApprovals, listArtifacts, listWorkflowJobs } from "@/infrastructure/control-center-repository";
import { listTopics } from "@/infrastructure/topic-repository";
import { listClaims, listSources } from "@/infrastructure/research-repository";
import { researchGate } from "@/domain/research";
import type { Storyboard } from "@/domain/storyboard";
import { listMediaAssets } from "@/infrastructure/asset-repository";
import { assetCoverage } from "@/domain/assets";
import { listRenders } from "@/application/video-renderer";
import type {SeoPackage} from "@/domain/publishing";
import {connectionStatus} from "@/infrastructure/youtube-auth";
import {getUpload} from "@/application/youtube-uploader";
import { listAnalyticsSnapshots, listRecommendations } from "@/infrastructure/analytics-repository";
import { ANALYTICS_WINDOWS, hoursLabel } from "@/domain/analytics";
import { getPublication } from "@/infrastructure/publication-repository";
import { journeySteps, workflowGuide } from "@/domain/workflow-guide";
import { ClaimForm, SourceForm } from "./ResearchForms";
import GuidedProjectView from "./GuidedProjectView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{view?:string}> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  const query=await searchParams;if(query.view!=="advanced")return <GuidedProjectView project={project}/>;
  const events = listProjectEvents(id);
  const artifacts = listArtifacts(id);
  const approvals = listApprovals(id);
  const jobs = listWorkflowJobs(id);
  const topics = listTopics(id);
  const sources = listSources(id);
  const claims = listClaims(id);
  const gate = researchGate(claims);
  const storyboard = artifacts.find(a=>a.artifactType==="STORYBOARD")?.content as unknown as Storyboard|undefined;
  const mediaAssets = listMediaAssets(id);
  const coverage = storyboard ? assetCoverage(storyboard.scenes.map(s=>s.id),mediaAssets) : null;
  const renders=listRenders(id);
  const seo=artifacts.find(a=>a.artifactType==="SEO_PACKAGE")?.content as unknown as SeoPackage|undefined;
  const publish=artifacts.find(a=>a.artifactType==="PUBLISH_PACKAGE")?.content as unknown as {zipUri:string;thumbnailUris:string[];checksum:string}|undefined;
  const youtube=connectionStatus(),upload=getUpload(id);
  const snapshots=listAnalyticsSnapshots(id),recommendations=listRecommendations(id);
  const publication=getPublication(id);
  const guide=workflowGuide(project.state);
  const submit = submitTopicForReview.bind(null, id);
  const createDraft = createDraftArtifactAction.bind(null, id);
  const approve = recordApprovalAction.bind(null, id);
  const createJob = createJobAction.bind(null, id);
  const runJob = runNextJobAction.bind(null, id);
  const generateTopics = generateTopicsAction.bind(null, id);
  const restartTopics=restartTopicSelectionAction.bind(null,id);
  const addSource = addResearchSourceAction.bind(null,id);
  const addClaim = addClaimAction.bind(null,id);
  const submitResearch = submitResearchForReviewAction.bind(null,id);
  const approveResearch = approveResearchAction.bind(null,id);
  const generateScript = generateScriptAction.bind(null,id);
  const approveScript = approveScriptAction.bind(null,id);
  const generateStoryboard = generateStoryboardAction.bind(null,id);
  const generateAssets = generateAssetsAction.bind(null,id);
  const renderVideo=renderVideoAction.bind(null,id);
  const buildPackage=buildPublishPackageAction.bind(null,id);
  const uploadPrivate=uploadPrivateAction.bind(null,id);
  const collectAnalytics=collectAnalyticsAction.bind(null,id);
  const selectThumbnail=selectThumbnailAction.bind(null,id),schedulePublication=schedulePublicationAction.bind(null,id),publishNow=publishNowAction.bind(null,id),reconcile=reconcilePublicationAction.bind(null,id);

  return (
    <div className="stack-xl">
      <Link className="back" href="/">← All projects</Link>
      <section className="hero compact">
        <div><p className="eyebrow">Video project</p><h1>{project.title}</h1><p className="lede">{project.language} · Target {project.targetDurationMinutes} minutes</p></div>
        <span className="status large">{guide.label}</span>
      </section>

      <section className="project-guide"><div className="project-progress">{journeySteps.map((step,index)=><div className={index<guide.journey?"done":index===guide.journey?"active":""} key={step}><span>{index<guide.journey?"✓":index+1}</span><small>{step}</small></div>)}</div><div className="next-action"><div><p className="eyebrow">Do this next</p><h2>{guide.title}</h2><p>{guide.description}</p></div><div className="next-action-button">{project.state==="DRAFT_IDEA"&&<form action={submit}><button>Start topic development</button></form>}{project.state==="TOPIC_REVIEW"&&topics.length===0&&<form action={generateTopics}><button>Generate topic options</button></form>}{project.state==="TOPIC_REVIEW"&&topics.length>0&&<a className="download" href="#topics">Choose a topic below</a>}{project.state==="RESEARCHING"&&<a className="download" href="#research">Add sources and claims</a>}{project.state==="RESEARCH_REVIEW"&&<form action={approveResearch}><button>Approve research</button></form>}{project.state==="SCRIPTING"&&<form action={generateScript}><button>Generate script</button></form>}{project.state==="SCRIPT_REVIEW"&&<form action={approveScript}><button>Approve script</button></form>}{project.state==="STORYBOARDING"&&<form action={generateStoryboard}><button>Create storyboard</button></form>}{project.state==="ASSET_GENERATION"&&<form action={generateAssets}><button>Create scene media</button></form>}{project.state==="RENDERING"&&<form action={renderVideo}><button>Render final video</button></form>}{project.state==="QA_REVIEW"&&<form action={buildPackage}><button>Run final review</button></form>}{project.state==="READY_TO_PUBLISH"&&<a className="download" href="#publish">Review upload settings</a>}{project.state==="UPLOADED_PRIVATE"&&<a className="download" href="#publish">Schedule or publish</a>}{project.state==="SCHEDULED"&&<form action={publishNow}><button>Publish now instead</button></form>}{project.state==="PUBLISHED"&&<form action={collectAnalytics}><input type="hidden" name="windowHours" value="24"/><button>Collect first results</button></form>}{project.state==="ANALYZING"&&<a className="download" href="#analytics">Review recommendations</a>}</div></div></section>

      <details className="advanced-section"><summary>View project history · {events.length} events</summary><div className="panel"><ol className="timeline">{events.map((event) => <li key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{workflowGuide(event.toState).label}</strong><p>{event.reason}</p></li>)}</ol></div></details>

      <section className="panel" id="topics">
        <div className="section-heading"><h2>Topic candidates</h2><span>{topics.length} scored ideas · {process.env.AI_PROVIDER === "openai" ? "OpenAI" : "Demo mode"}</span></div>
        {project.state === "TOPIC_REVIEW" && <form action={generateTopics}><button type="submit">Generate scored topics</button></form>}
        {project.state === "DRAFT_IDEA" && <p className="muted">Submit the idea to topic review before generating candidates.</p>}{["RESEARCHING","RESEARCH_REVIEW","SCRIPTING","SCRIPT_REVIEW"].includes(project.state)&&<form action={restartTopics}><p className="muted">These options do not match the project idea? Restart topic selection to generate a new set from “{project.title}”. Existing research will be cleared.</p><button className="secondary">Choose a different topic</button></form>}
        <div className="topic-grid">{topics.map(topic => {
          const selectTopic=approveTopicAction.bind(null,id,topic.id);
          return <article className="topic-card" key={topic.id}>
            <div className="score">{topic.totalScore}</div><div><span className={`badge ${topic.status.toLowerCase()}`}>{topic.status}</span><h3>{topic.title}</h3><p>{topic.hook}</p><small>{topic.primaryKeyword} · {topic.intent}</small></div>
            {project.state === "TOPIC_REVIEW" && topic.status === "PROPOSED" && <form action={selectTopic}><button className="secondary">Approve topic</button></form>}
          </article>})}</div>
      </section>

      {(project.state === "RESEARCHING" || project.state === "RESEARCH_REVIEW" || project.state === "SCRIPTING" || project.state === "SCRIPT_REVIEW") && <section className="stack-xl" id="research">
        <div className="section-title"><div><p className="eyebrow">Evidence workspace</p><h2>Research and claim ledger</h2></div><span className={`gate ${gate.pass ? "pass":"fail"}`}>{gate.pass ? "GATE READY":"GATE BLOCKED"}</span></div>
        <div className="grid-two">
          <div className="panel"><div className="section-heading"><h2>Sources</h2><span>{sources.length} recorded</span></div>
            {project.state === "RESEARCHING" && <SourceForm projectId={id} action={addSource}/>}<div className="record-list">{sources.map(s=><div className="record" key={s.id}><div><strong>{s.title}</strong><span>{s.publisher} · {s.trustLevel}</span></div><a href={s.url} target="_blank" rel="noreferrer">Source ↗</a></div>)}</div>
          </div>
          <div className="panel"><div className="section-heading"><h2>Claims</h2><span>{claims.length} tracked</span></div>
            {project.state === "RESEARCHING" && <ClaimForm projectId={id} action={addClaim} sources={sources.map(source=>({id:source.id,title:source.title}))}/>}<div className="record-list">{claims.map(c=><div className="record" key={c.id}><div><strong>{c.claimText}</strong><span>{c.evidence}</span></div><span className={`badge ${c.supportStatus.toLowerCase()}`}>{c.supportStatus}</span></div>)}</div>
          </div>
        </div>
        <div className="panel gate-panel">{!gate.pass && <ul>{gate.reasons.map(r=><li key={r}>{r}</li>)}</ul>}{project.state === "RESEARCHING" && <form action={submitResearch}><button disabled={!gate.pass}>Submit research for review</button></form>}{project.state === "RESEARCH_REVIEW" && <form action={approveResearch}><button>Approve research package</button></form>}{project.state === "SCRIPTING" && <form action={generateScript}><button>Generate grounded script</button></form>}{project.state === "SCRIPT_REVIEW" && <form action={approveScript}><button>Approve script for storyboarding</button></form>}</div>
      </section>}

      {(project.state === "STORYBOARDING" || project.state === "ASSET_GENERATION" || storyboard) && <section className="panel">
        <div className="section-heading"><h2>Storyboard and production manifest</h2><span>{storyboard ? `${storyboard.scenes.length} scenes · ${storyboard.totalDurationSeconds}s` : "Awaiting generation"}</span></div>
        {project.state === "STORYBOARDING" && <form action={generateStoryboard}><button>Generate storyboard and manifest</button></form>}
        {storyboard && <div className="scene-list">{storyboard.scenes.map(scene=><article className="scene" key={scene.id}><div className="scene-number">{String(scene.order).padStart(2,"0")}</div><div><strong>{scene.visualType.replaceAll("_"," ")}</strong><p>{scene.narration}</p><small>{scene.durationSeconds}s · {scene.transition}{scene.overlay ? ` · ${scene.overlay}`:""}</small></div></article>)}</div>}
      </section>}

      {(project.state === "ASSET_GENERATION" || project.state === "RENDERING" || mediaAssets.length>0) && <section className="panel">
        <div className="section-heading"><h2>Asset production</h2><span>{mediaAssets.length} ready · ${mediaAssets.reduce((sum,a)=>sum+a.actualCostUsd,0).toFixed(2)} actual</span></div>
        {project.state === "ASSET_GENERATION" && <div className="gate-panel"><p className="muted">Generate local review assets for every scene and a timed narration manifest. These are provenance-safe placeholders, not final media.</p><form action={generateAssets}><button>Generate demo assets</button></form></div>}
        {coverage && <p className={`coverage ${coverage.pass?"pass":"fail"}`}>{coverage.pass?"Asset coverage complete":"Asset coverage incomplete"} · {coverage.missing.length} missing scenes · Narration {coverage.hasNarration?"ready":"missing"}</p>}
        <div className="asset-grid">{mediaAssets.map(asset=><article className="asset-card" key={asset.id}>{asset.mimeType==="image/svg+xml"&&<Image src={asset.uri} width={480} height={270} unoptimized alt={`Generated visual for ${asset.sceneId}`}/>}<div><strong>{asset.sceneId??"Full narration"} · {asset.assetKind}</strong><p>{asset.provenance}</p><small>{asset.provider} · {asset.license} · {asset.checksum.slice(0,12)}…</small></div></article>)}</div>
      </section>}
      {(project.state==="RENDERING"||project.state==="QA_REVIEW"||renders.length>0)&&<section className="panel"><div className="section-heading"><h2>Video render and technical QA</h2><span>{renders.length} renders</span></div>{project.state==="RENDERING"&&<form action={renderVideo}><button>Render final demo MP4</button></form>}{renders.map(r=><article className="render-card" key={r.id}><video controls preload="metadata" src={r.videoUri}/><div><strong>{r.qa.pass?"QA PASSED":"QA FAILED"}</strong><p>{r.width}×{r.height} · {r.videoCodec.toUpperCase()} + {r.audioCodec.toUpperCase()} · {r.durationSeconds.toFixed(1)}s</p><small>{Object.entries(r.qa.checks).map(([k,v])=>`${v?"✓":"✗"} ${k}`).join(" · ")}</small><a href={r.captionsUri} download>Download captions</a></div></article>)}</section>}
      {(project.state==="QA_REVIEW"||project.state==="READY_TO_PUBLISH"||publish)&&<section className="panel"><div className="section-heading"><h2>Publishing package</h2><span>{publish?"READY":"FINAL QA"}</span></div>{project.state==="QA_REVIEW"&&<form action={buildPackage}><button>Run final QA and build ZIP</button></form>}{publish&&<><form action={selectThumbnail}><div className="thumbnail-grid">{publish.thumbnailUris.map((uri,i)=>{const name=`thumbnail-${String.fromCharCode(97+i)}.svg`;return <label className={publication?.selectedThumbnail===name?"thumbnail-selected":""} key={uri}><Image src={uri} width={384} height={216} unoptimized alt={`Thumbnail candidate ${i+1}`}/><input type="radio" name="thumbnail" value={name} defaultChecked={(publication?.selectedThumbnail??"thumbnail-a.svg")===name}/></label>})}</div><button>Select thumbnail</button></form>{seo&&<div className="seo-preview"><h3>{seo.selectedTitle}</h3><p>{seo.description}</p><small>{seo.tags.join(" · ")}</small></div>}<a className="download" href={publish.zipUri} download>Download publishing package ZIP</a><p className="muted">Checksum: {publish.checksum}</p></>}</section>}
      {(project.state==="READY_TO_PUBLISH"||["UPLOADED_PRIVATE","SCHEDULED","PUBLISHED","ANALYZING"].includes(project.state)||upload)&&<section className="panel"><div className="section-heading"><h2>Publication lifecycle</h2><span>{process.env.PUBLISH_PROVIDER==="youtube"?"LIVE YOUTUBE":"LOCAL DEMO"} · {upload?.status??"NOT UPLOADED"}</span></div>{project.state==="READY_TO_PUBLISH"&&(process.env.PUBLISH_PROVIDER!=="youtube"||youtube.connected)&&<form className="form" action={uploadPrivate}><label>Made for children?<select name="madeForKids"><option value="false">No</option><option value="true">Yes</option></select></label><label>Contains realistic synthetic media?<select name="containsSyntheticMedia"><option value="false">No</option><option value="true">Yes</option></select></label><button>Upload privately</button></form>}{project.state==="READY_TO_PUBLISH"&&process.env.PUBLISH_PROVIDER==="youtube"&&!youtube.connected&&<p className="coverage fail">Connect YouTube from Channel settings before using live publishing.</p>}{project.state==="UPLOADED_PRIVATE"&&<div className="publish-controls"><form className="form" action={schedulePublication}><label>Schedule publication<input name="publishAt" type="datetime-local" required/></label><button>Schedule</button></form><form action={publishNow}><button>Publish now</button></form></div>}{project.state==="SCHEDULED"&&<form action={publishNow}><p className="coverage pass">Scheduled for {publication?.scheduledAt?new Date(publication.scheduledAt).toLocaleString():"the selected time"}</p><button>Publish now instead</button></form>}{upload&&<form action={reconcile}><button className="secondary">Reconcile status</button></form>}{publication&&<p className="muted">Privacy: {publication.privacyStatus} · Thumbnail: {publication.selectedThumbnail} · Last reconciled: {publication.reconciledAt?new Date(publication.reconciledAt).toLocaleString():"not yet"}</p>}{upload?.youtubeVideoId&&process.env.PUBLISH_PROVIDER==="youtube"&&<a className="download" href={`https://studio.youtube.com/video/${upload.youtubeVideoId}/edit`} target="_blank" rel="noreferrer">Open video in YouTube Studio</a>}</section>}

      {(["READY_TO_PUBLISH","UPLOADED_PRIVATE","SCHEDULED","PUBLISHED","ANALYZING"].includes(project.state)||snapshots.length>0)&&<section className="panel"><div className="section-heading"><h2>Analytics and learning loop</h2><span>{process.env.ANALYTICS_PROVIDER==="youtube"?"YOUTUBE DATA":"DEMO DATA"}</span></div><form className="analytics-collector" action={collectAnalytics}><label>Measurement window<select name="windowHours" defaultValue="24">{ANALYTICS_WINDOWS.map(window=><option key={window} value={window}>{hoursLabel(window)}</option>)}</select></label><button>Collect snapshot</button></form>{snapshots.length>0&&<div className="snapshot-table"><div className="snapshot-row snapshot-head"><span>Window</span><span>Views</span><span>Watch min.</span><span>Avg. viewed</span><span>CTR</span><span>Subscribers</span></div>{snapshots.map(snapshot=><div className="snapshot-row" key={snapshot.id}><strong>{hoursLabel(snapshot.windowHours)}</strong><span>{snapshot.views.toLocaleString()}</span><span>{Math.round(snapshot.estimatedMinutesWatched).toLocaleString()}</span><span>{snapshot.averageViewPercentage.toFixed(1)}%</span><span>{snapshot.impressionCtr===null?"Unavailable":`${snapshot.impressionCtr.toFixed(1)}%`}</span><span>+{snapshot.subscribersGained}</span></div>)}</div>}<div className="recommendation-list">{recommendations.map(item=>{const decide=decideRecommendationAction.bind(null,id,item.id);return <article className="recommendation" key={item.id}><div><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span><small>{item.category} · {item.confidence} CONFIDENCE</small><h3>{item.finding}</h3><p>{item.recommendation}</p><details><summary>Evidence</summary><pre>{JSON.stringify(item.evidence,null,2)}</pre></details></div>{item.status==="PROPOSED"&&<form action={decide}><button name="decision" value="APPROVED">Approve experiment</button><button className="secondary" name="decision" value="REJECTED">Reject</button></form>}</article>})}</div>{snapshots.length===0&&<p className="muted">Collect the 24-hour, 72-hour, 7-day, and 30-day windows. Demo mode produces deterministic sample data; YouTube mode requires a connected uploaded video.</p>}</section>}

      <details className="advanced-section"><summary>Advanced records and workflow controls</summary><section className="grid-two">
        <div className="panel">
          <div className="section-heading"><h2>Versioned artifacts</h2><span>{artifacts.length} revisions</span></div>
          <form className="form compact-form" action={createDraft}>
            <select name="artifactType"><option>TOPIC_BRIEF</option><option>RESEARCH_BRIEF</option><option>SCRIPT</option><option>STORYBOARD</option><option>RENDER_MANIFEST</option><option>SEO_PACKAGE</option></select>
            <input name="summary" required minLength={3} placeholder="Artifact summary"/><button>Create draft revision</button>
          </form>
          <div className="record-list">{artifacts.map(a => <div className="record" key={a.id}><div><strong>{a.artifactType} v{a.version}</strong><span>{a.checksum.slice(0,12)}…</span></div><span className={`badge ${a.status.toLowerCase()}`}>{a.status}</span></div>)}</div>
        </div>
        <div className="panel">
          <div className="section-heading"><h2>Approval ledger</h2><span>{approvals.length} decisions</span></div>
          <form className="form compact-form" action={approve}>
            <input name="stage" defaultValue={project.state} required/>
            <select name="artifactId" defaultValue=""><option value="">Stage only</option>{artifacts.map(a => <option value={a.id} key={a.id}>{a.artifactType} v{a.version}</option>)}</select>
            <div className="form-row"><select name="decision"><option>APPROVED</option><option>REJECTED</option></select><input name="reviewer" defaultValue="Owner" required/></div>
            <input name="notes" placeholder="Decision notes" required minLength={3}/><button>Record decision</button>
          </form>
          <div className="record-list">{approvals.map(a => <div className="record" key={a.id}><div><strong>{a.stage}</strong><span>{a.reviewer}: {a.notes}</span></div><span className={`badge ${a.decision.toLowerCase()}`}>{a.decision}</span></div>)}</div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading"><h2>Workflow jobs</h2><span>{jobs.length} durable jobs</span></div>
        <form className="job-form" action={createJob}><input name="jobType" defaultValue="TOPIC_RESEARCH" required/><input name="estimatedCostUsd" type="number" min="0" step="0.01" defaultValue="0"/><button>Queue durable job</button></form>
        <form action={runJob}><button className="secondary" type="submit">Run next queued job</button></form>
        <div className="record-list">{jobs.map(j => <div className="record" key={j.id}><div><strong>{j.jobType}</strong><span>Attempt {j.attempt}/{j.maxAttempts} · Est. ${j.estimatedCostUsd.toFixed(2)}</span></div><span className={`badge ${j.status.toLowerCase()}`}>{j.status}</span></div>)}</div>
      </section>
      </details>
    </div>
  );
}
