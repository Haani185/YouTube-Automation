import Link from "next/link";
import Image from "next/image";
import type { VideoProject } from "@/domain/video-project";
import { journeySteps, workflowGuide } from "@/domain/workflow-guide";
import { researchGate } from "@/domain/research";
import type { ScriptDraft } from "@/application/script-generator";
import type { Storyboard } from "@/domain/storyboard";
import type { SeoPackage } from "@/domain/publishing";
import { listTopics } from "@/infrastructure/topic-repository";
import { listClaims, listSources } from "@/infrastructure/research-repository";
import { listArtifacts } from "@/infrastructure/control-center-repository";
import { listMediaAssets } from "@/infrastructure/asset-repository";
import { listRenders } from "@/application/video-renderer";
import { getUpload } from "@/application/youtube-uploader";
import { getPublication } from "@/infrastructure/publication-repository";
import { listAnalyticsSnapshots, listRecommendations } from "@/infrastructure/analytics-repository";
import { ANALYTICS_WINDOWS, hoursLabel } from "@/domain/analytics";
import { SourceForm, ClaimForm } from "./ResearchForms";
import { addClaimAction,addResearchSourceAction,approveResearchAction,approveScriptAction,approveTopicAction,buildPublishPackageAction,collectAnalyticsAction,decideRecommendationAction,generateAssetsAction,generateScriptAction,generateStoryboardAction,generateTopicsAction,publishNowAction,reconcilePublicationAction,renderVideoAction,restartTopicSelectionAction,schedulePublicationAction,selectThumbnailAction,submitResearchForReviewAction,submitTopicForReview,uploadPrivateAction,updateScriptAction } from "../../actions";

export default function GuidedProjectView({project}:{project:VideoProject}){
  const id=project.id,guide=workflowGuide(project.state),topics=listTopics(id),sources=listSources(id),claims=listClaims(id),gate=researchGate(claims),artifacts=listArtifacts(id),assets=listMediaAssets(id),renders=listRenders(id),upload=getUpload(id),publication=getPublication(id),snapshots=listAnalyticsSnapshots(id),recommendations=listRecommendations(id);
  const script=artifacts.find(item=>item.artifactType==="SCRIPT")?.content as unknown as ScriptDraft|undefined;
  const storyboard=artifacts.find(item=>item.artifactType==="STORYBOARD")?.content as unknown as Storyboard|undefined;
  const seo=artifacts.find(item=>item.artifactType==="SEO_PACKAGE")?.content as unknown as SeoPackage|undefined;
  const publish=artifacts.find(item=>item.artifactType==="PUBLISH_PACKAGE")?.content as unknown as {zipUri:string;thumbnailUris:string[]}|undefined;
  const action=(fn:unknown)=>(fn as (projectId:string,formData:FormData)=>void|Promise<void>).bind(null,id);
  const is=(...states:VideoProject["state"][])=>states.includes(project.state);
  return <div className="guided-shell">
    <div className="guided-top"><Link className="back" href="/">← My videos</Link><Link className="advanced-link" href={`/projects/${id}?view=advanced`}>Advanced view</Link></div>
    <header className="guided-header"><div><span className="step-label">Step {guide.journey+1} of 5</span><h1>{project.title} <span className={`format-pill ${project.format === "SHORT" ? "short" : "long"}`}>{project.format === "SHORT" ? "📱 9:16 Shorts" : "🎥 16:9 Long-Form"}</span></h1><p>{guide.description}</p></div><span className="status large">{guide.label}</span></header>
    <div className="beginner-progress">{journeySteps.map((step,index)=><div className={index<guide.journey?"complete":index===guide.journey?"current":""} key={step}><i>{index<guide.journey?"✓":index+1}</i><span>{step}</span></div>)}</div>
    <main className="guided-workspace">
      <div className="workspace-heading"><span className="eyebrow">Your current task</span><h2>{guide.title}</h2></div>

      {is("DRAFT_IDEA")&&<div className="beginner-card"><h3>Ready to develop this idea?</h3><p>We will create several possible YouTube titles from your idea. Nothing will be published.</p><form action={action(submitTopicForReview)}><button>Start creating topic options</button></form></div>}

      {is("TOPIC_REVIEW")&&<div className="beginner-stack">{topics.filter(t=>t.status==="PROPOSED").length===0?<div className="beginner-card"><h3>Generate five topic options</h3><p>Each option will stay focused on “{project.title}”. You will choose one before continuing.</p><form action={action(generateTopicsAction)}><button>✦ Generate topic options</button></form></div>:<><p className="beginner-help">Choose the option that best matches the video you want to create.</p>{topics.filter(t=>t.status==="PROPOSED").map(topic=><article className="choice-card" key={topic.id}><div><span className="score-pill">Score {topic.totalScore}</span><h3>{topic.title}</h3><p>{topic.hook}</p><small>For: {topic.audience}</small></div><form action={approveTopicAction.bind(null,id,topic.id)}><button>Use this topic</button></form></article>)}</>}</div>}

      {is("RESEARCHING")&&<div className="beginner-stack"><div className="beginner-note"><strong>Why research?</strong><span>It keeps factual statements accurate and gives the script evidence it can cite.</span></div><div className="guided-columns"><section className="beginner-card"><div className="card-title"><h3>1. Add a source</h3><span>{sources.length} saved</span></div><SourceForm projectId={id} action={action(addResearchSourceAction)}/>{sources.map(source=><div className="saved-item" key={source.id}><strong>{source.title}</strong><a href={source.url} target="_blank" rel="noreferrer">Check source ↗</a></div>)}</section><section className="beginner-card"><div className="card-title"><h3>2. Add a supported claim</h3><span>{claims.length} saved</span></div><ClaimForm projectId={id} action={action(addClaimAction)} sources={sources.map(s=>({id:s.id,title:s.title}))}/>{claims.map(claim=><div className="saved-item" key={claim.id}><strong>{claim.claimText}</strong><span className="badge supported">SUPPORTED</span></div>)}</section></div><div className={`ready-bar ${gate.pass?"ready":"waiting"}`}><div><strong>{gate.pass?"Research is ready":"Complete the items above"}</strong><span>{gate.pass?"Your evidence can now be reviewed.":gate.reasons.join(" · ")}</span></div><form action={action(submitResearchForReviewAction)}><button disabled={!gate.pass}>Continue to review</button></form></div><form action={action(restartTopicSelectionAction)}><button className="text-button">← Choose a different topic</button></form></div>}

      {is("RESEARCH_REVIEW")&&<ReviewCard title="Review the evidence" description={`${sources.length} sources and ${claims.length} claims are ready. Confirm they match the topic before script generation.`} action={action(approveResearchAction)} button="Approve and continue"/>}
      {is("SCRIPTING")&&<ReviewCard title="Create a source-grounded script" description="The script generator will use only the topic and evidence you approved." action={action(generateScriptAction)} button="✦ Generate script"/>}
      {is("SCRIPT_REVIEW")&&<div className="beginner-stack">
        <div className="beginner-card script-preview">
          <div className="card-title">
            <div>
              <h3>{script?.title??"Generated script"}</h3>
              <small className="muted">{script?.sections.length??0} sections · {script?.wordCount??0} words (~{script?.estimatedMinutes??1} min)</small>
            </div>
            <span className={`format-pill ${project.format==="SHORT"?"short":"long"}`}>{project.format==="SHORT"?"📱 Shorts":"🎥 16:9"}</span>
          </div>
          <p className="beginner-help">Review and edit any section below. Click Save to update the text before approving.</p>
          <div className="script-sections-editor">
            {script?.sections.map((section,idx)=>(
              <form key={idx} className="script-edit-card" action={action(updateScriptAction)}>
                <input type="hidden" name="sectionIndex" value={idx}/>
                <div className="section-head-row">
                  <span className="section-num">#{idx+1}</span>
                  <input className="edit-heading-input" name="heading" defaultValue={section.heading} required/>
                  <button type="submit" className="save-section-btn">Save</button>
                </div>
                <textarea className="edit-narration-textarea" name="narration" defaultValue={section.narration} rows={3} required/>
              </form>
            ))}
          </div>
        </div>
        <form className="primary-row" action={action(approveScriptAction)}><button>Approve script and continue</button></form>
      </div>}
      {is("STORYBOARDING")&&<ReviewCard title="Create the visual plan" description="The platform will split the approved script into timed scenes with visuals, overlays, and transitions." action={action(generateStoryboardAction)} button="✦ Create storyboard"/>}
      {is("ASSET_GENERATION")&&<ReviewCard title="Create visuals and voice for every scene" description={`${storyboard?.scenes.length??0} scenes will receive free local visuals and an offline AI-style voice. No paid API key is needed.`} action={action(generateAssetsAction)} button="✦ Create free media"/>}
      {is("RENDERING")&&<div className="beginner-stack"><div className="beginner-card"><h3>Everything is ready to render</h3><p>{assets.length} media assets will be combined with background ambient music and captions into a Full HD MP4. This may take about a minute.</p>{assets.filter(a=>a.mimeType==="image/svg+xml").slice(0,3).length>0&&<div className="preview-strip">{assets.filter(a=>a.mimeType==="image/svg+xml").slice(0,3).map(asset=><Image key={asset.id} src={asset.uri} width={300} height={169} unoptimized alt="Scene preview"/>)}</div>}<form action={action(renderVideoAction)}><button>Render final video</button></form></div></div>}
      {is("QA_REVIEW")&&<div className="beginner-stack">
        {renders[0]&&<video className={`guided-video ${project.format==="SHORT"?"shorts-video":""}`} controls src={renders[0].videoUri}/>}
        {publish&&<div className="feed-simulator-panel">
          <div className="section-heading"><div><p className="eyebrow">Visual Feed Mockup</p><h3>YouTube Mobile &amp; Desktop Simulator</h3></div><span className="badge">Feed Preview</span></div>
          <div className="simulator-previews">
            <div className="mockup-phone">
              <div className="phone-notch"/>
              <div className="phone-screen">
                <div className="yt-video-card">
                  <div className="yt-thumb-wrap">
                    <Image src={publish.thumbnailUris[0]} width={320} height={180} unoptimized alt="Thumbnail preview"/>
                    <span className="yt-duration-pill">{Math.floor((renders[0]?.durationSeconds??60)/60)}:{String(Math.round((renders[0]?.durationSeconds??60)%60)).padStart(2,'0')}</span>
                  </div>
                  <div className="yt-meta-row">
                    <div className="yt-avatar"/>
                    <div className="yt-meta-text">
                      <h4>{seo?.selectedTitle??project.title}</h4>
                      <p>Your Channel · 12K views · 2 hours ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}
        <ReviewCard title="Create the publishing package" description="The final check will create three high-CTR thumbnails, YouTube metadata, captions, and a downloadable package." action={action(buildPublishPackageAction)} button="Run final review"/>
      </div>}
      {is("READY_TO_PUBLISH")&&<div className="beginner-stack">{publish&&<form className="beginner-card" action={action(selectThumbnailAction)}><h3>Choose a thumbnail</h3><div className="thumbnail-grid">{publish.thumbnailUris.map((uri,index)=>{const name=`thumbnail-${String.fromCharCode(97+index)}.svg`;return <label key={uri}><Image src={uri} width={384} height={216} unoptimized alt={`Thumbnail ${index+1}`}/><input type="radio" name="thumbnail" value={name} defaultChecked={(publication?.selectedThumbnail??"thumbnail-a.svg")===name}/></label>})}</div><button>Save thumbnail choice</button></form>}<form className="beginner-card form" action={action(uploadPrivateAction)}><h3>Create a private upload</h3><p>Private means viewers cannot see it until you deliberately publish it.</p><label>Made for children?<select name="madeForKids"><option value="false">No</option><option value="true">Yes</option></select></label><label>Contains realistic synthetic media?<select name="containsSyntheticMedia"><option value="false">No</option><option value="true">Yes</option></select></label><button>Upload privately</button></form>{seo&&<p className="beginner-help">YouTube title: {seo.selectedTitle}</p>}</div>}
      {is("UPLOADED_PRIVATE")&&<div className="guided-columns"><form className="beginner-card form" action={action(schedulePublicationAction)}><h3>Schedule for later</h3><label>Publication date and time<input name="publishAt" type="datetime-local" required/></label><button>Schedule video</button></form><form className="beginner-card" action={action(publishNowAction)}><h3>Publish immediately</h3><p>This changes the demo video from private to public.</p><button>Publish now</button></form></div>}
      {is("SCHEDULED")&&<ReviewCard title="Your video is scheduled" description={publication?.scheduledAt?`Scheduled for ${new Date(publication.scheduledAt).toLocaleString()}.`:"A publication time has been saved."} action={action(publishNowAction)} button="Publish now instead"/>}
      {is("PUBLISHED","ANALYZING")&&<div className="beginner-stack"><form className="beginner-card form" action={action(collectAnalyticsAction)}><h3>Collect performance results</h3><label>Time window<select name="windowHours">{ANALYTICS_WINDOWS.map(hours=><option value={hours} key={hours}>{hoursLabel(hours)}</option>)}</select></label><button>Collect analytics</button></form>{snapshots.length>0&&<div className="analytics-metrics"><div><strong>{snapshots.at(-1)!.views}</strong><span>Views</span></div><div><strong>{snapshots.at(-1)!.averageViewPercentage}%</strong><span>Average viewed</span></div><div><strong>{snapshots.at(-1)!.subscribersGained}</strong><span>Subscribers</span></div><div><strong>{snapshots.length}/4</strong><span>Windows collected</span></div></div>}{recommendations.map(item=><article className="choice-card" key={item.id}><div><h3>{item.finding}</h3><p>{item.recommendation}</p></div>{item.status==="PROPOSED"&&<form action={decideRecommendationAction.bind(null,id,item.id)}><button name="decision" value="APPROVED">Approve experiment</button></form>}</article>)}</div>}
      {is("UPLOADING","PUBLISH_APPROVAL")&&<div className="beginner-card"><h3>Upload in progress</h3><p>Keep this page open. The next step will appear when the private upload finishes.</p></div>}
      {is("FAILED_RETRYABLE","FAILED_BLOCKED")&&<div className="beginner-card error-card"><h3>This step needs attention</h3><p>Open Advanced view to inspect the failure record and retry safely.</p></div>}
      {is("CANCELLED")&&<div className="beginner-card"><h3>This project is closed</h3><p>Return to My videos to begin a new project.</p></div>}
    </main>
    {upload&&<form className="quiet-action" action={action(reconcilePublicationAction)}><button className="text-button">Refresh publication status</button></form>}
  </div>
}

function ReviewCard({title,description,action,button}:{title:string;description:string;action:(formData:FormData)=>void|Promise<void>;button:string}){return <div className="beginner-card"><h3>{title}</h3><p>{description}</p><form action={action}><button>{button}</button></form></div>}
