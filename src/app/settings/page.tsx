import { disconnectYouTubeAction, saveChannelProfileAction } from "../actions";
import { getChannelProfile } from "@/infrastructure/control-center-repository";
import {connectionStatus} from "@/infrastructure/youtube-auth";
import {safeLiveYouTubeChannel} from "@/application/youtube-channel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({searchParams}:{searchParams:Promise<{youtube?:string;reason?:string}>}) {
  const p = getChannelProfile();
  const youtube=connectionStatus();
  const live=youtube.connected?await safeLiveYouTubeChannel():{data:null,error:null};
  const query=await searchParams;
  return <div className="stack-xl">
    <section className="hero compact"><div><p className="eyebrow">Control Center</p><h1>Channel and brand profile</h1><p className="lede">These constraints become the authoritative input for every future agent.</p></div></section>
    <form className="panel settings-form" action={saveChannelProfileAction}>
      <div className="form-row"><label>Channel name<input name="channelName" defaultValue={p.channelName} required /></label><label>Primary language<input name="language" defaultValue={p.language} required /></label></div>
      <label>Niche<input name="niche" defaultValue={p.niche} required /></label>
      <label>Target audience<textarea name="targetAudience" defaultValue={p.targetAudience} required /></label>
      <div className="form-row"><label>Timezone<input name="timezone" defaultValue={p.timezone} required /></label><label>Videos per week<input name="weeklyFrequency" type="number" min="1" max="14" defaultValue={p.weeklyFrequency} /></label></div>
      <label>Default duration in minutes<input name="defaultDurationMinutes" type="number" min="1" max="180" defaultValue={p.defaultDurationMinutes} /></label>
      <label>Writing tone<textarea name="tone" defaultValue={p.tone} required /></label>
      <label>Visual style<textarea name="visualStyle" defaultValue={p.visualStyle} required /></label>
      <label>Brand colors<input name="brandColors" defaultValue={p.brandColors} required /></label>
      <label>Narrator style<textarea name="narratorStyle" defaultValue={p.narratorStyle} required /></label>
      <label>Prohibited topics and patterns<textarea name="prohibitedTopics" defaultValue={p.prohibitedTopics} /></label>
      <button type="submit">Save authoritative profile</button>
    </form>
    <section className="panel youtube-connect"><div className="section-heading"><div><p className="eyebrow">Live channel data</p><h2>YouTube connection</h2></div><span>{youtube.connected?"CONNECTED":youtube.configured?"READY TO CONNECT":"SETUP REQUIRED"}</span></div>{query.youtube==="connected"&&<p className="coverage pass">Your YouTube channel is connected successfully.</p>}{query.youtube==="error"&&<p className="coverage fail">Connection was not completed: {query.reason?.replaceAll("_"," ")??"unknown error"}.</p>}<p className="muted">Secure Google OAuth is used. Access and refresh tokens are encrypted before local storage and are never shown in the browser.</p>{youtube.configured&&!youtube.connected&&<a className="download" href="/api/youtube/oauth/start">Connect with Google</a>}{youtube.connected&&<><p className="coverage pass">Connected for channel data, analytics, and private video uploads.</p>{live.data&&<div className="youtube-channel-card"><div><strong>{live.data.title}</strong><span>{live.data.customUrl??live.data.id}</span></div><div className="channel-stats"><span><strong>{live.data.subscribers.toLocaleString()}</strong> subscribers</span><span><strong>{live.data.views.toLocaleString()}</strong> channel views</span><span><strong>{live.data.videos.toLocaleString()}</strong> videos</span></div></div>}{live.error&&<p className="coverage fail">Connected, but live data could not be loaded. {live.error}</p>}<form action={disconnectYouTubeAction}><button className="secondary" type="submit">Disconnect YouTube</button></form></>}{!youtube.configured&&<div className="setup-steps"><strong>One-time connection setup</strong><ol><li>Create a <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud project</a> and enable YouTube Data API v3 and YouTube Analytics API.</li><li>Create an OAuth web client with callback <code>http://localhost:3000/api/youtube/oauth/callback</code>.</li><li>Add the client ID, secret, redirect URL, and encryption key to <code>.env.local</code>.</li><li>Restart the local server, then return here and click Connect with Google.</li></ol></div>}</section>
  </div>;
}
