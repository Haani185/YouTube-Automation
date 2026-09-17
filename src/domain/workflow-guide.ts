import type { ProjectState } from "./video-project";

export const journeySteps=["Choose an idea","Write the video","Create media","Review and publish","Learn from results"] as const;
const guide:Record<ProjectState,{journey:number;label:string;title:string;description:string}>={
  DRAFT_IDEA:{journey:0,label:"Idea draft",title:"Confirm the video idea",description:"Start the guided workflow by sending this idea for topic development."},
  TOPIC_REVIEW:{journey:0,label:"Choose a topic",title:"Generate and choose a topic",description:"Create scored topic options, then approve the strongest one."},
  RESEARCHING:{journey:1,label:"Add research",title:"Support the video with evidence",description:"Add reliable sources and link every factual claim to its evidence."},
  RESEARCH_REVIEW:{journey:1,label:"Review research",title:"Approve the research",description:"Check the evidence package, then approve it for script writing."},
  SCRIPTING:{journey:1,label:"Write script",title:"Generate the script",description:"Create a structured script using only the approved evidence."},
  SCRIPT_REVIEW:{journey:1,label:"Review script",title:"Approve the script",description:"Read the script and approve it before visual production."},
  STORYBOARDING:{journey:2,label:"Build storyboard",title:"Create the visual plan",description:"Turn the approved script into timed scenes and visual instructions."},
  ASSET_GENERATION:{journey:2,label:"Create media",title:"Create scene media",description:"Generate a visual for every scene and prepare the narration track."},
  RENDERING:{journey:2,label:"Render video",title:"Render the final video",description:"Combine scenes, narration, and captions into the final MP4."},
  QA_REVIEW:{journey:3,label:"Final review",title:"Check and package the video",description:"Run final quality checks and build the upload package."},
  READY_TO_PUBLISH:{journey:3,label:"Ready to upload",title:"Upload the video privately",description:"Confirm audience and disclosure settings, then create a private upload."},
  PUBLISH_APPROVAL:{journey:3,label:"Upload approved",title:"Complete the private upload",description:"The upload has been approved and is preparing to start."},
  UPLOADING:{journey:3,label:"Uploading",title:"Wait for the upload",description:"The video upload is currently in progress."},
  UPLOADED_PRIVATE:{journey:3,label:"Private upload",title:"Schedule or publish",description:"Review the private upload, then schedule it or publish immediately."},
  SCHEDULED:{journey:3,label:"Scheduled",title:"Wait for publication",description:"The video has a publication time. You can still publish it immediately."},
  PUBLISHED:{journey:4,label:"Published",title:"Measure performance",description:"Collect the first analytics snapshot and begin the learning loop."},
  ANALYZING:{journey:4,label:"Measuring results",title:"Review performance lessons",description:"Compare analytics windows and approve useful experiments."},
  FAILED_RETRYABLE:{journey:2,label:"Needs retry",title:"Retry the failed step",description:"Review the failure details and retry from the appropriate production stage."},
  FAILED_BLOCKED:{journey:2,label:"Needs attention",title:"Resolve the blocker",description:"A manual decision is required before this project can continue."},
  CANCELLED:{journey:0,label:"Cancelled",title:"Project closed",description:"This project is no longer active."},
};
export const workflowGuide=(state:ProjectState)=>guide[state];
