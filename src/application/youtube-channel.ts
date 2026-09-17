import {accessToken,connectionStatus} from "@/infrastructure/youtube-auth";

export type LiveYouTubeChannel={id:string;title:string;description:string;customUrl:string|null;thumbnail:string|null;subscribers:number;views:number;videos:number;uploadsPlaylistId:string;recentUploads:Array<{id:string;title:string;publishedAt:string;thumbnail:string|null}>;last28Days:{views:number;watchMinutes:number;subscribersGained:number;likes:number;comments:number};fetchedAt:string};

async function googleJson<T>(url:string):Promise<T>{const response=await fetch(url,{headers:{Authorization:`Bearer ${await accessToken()}`},cache:"no-store"});if(!response.ok){const message=await response.text();throw new Error(`YouTube request failed (${response.status}): ${message.slice(0,180)}`)}return response.json() as Promise<T>}
const date=(daysAgo:number)=>new Date(Date.now()-daysAgo*86400000).toISOString().slice(0,10);

export async function getLiveYouTubeChannel():Promise<LiveYouTubeChannel|null>{
  if(!connectionStatus().connected)return null;
  const channelResponse=await googleJson<{items?:Array<{id:string;snippet:{title:string;description:string;customUrl?:string;thumbnails?:Record<string,{url:string}>};statistics:{subscriberCount?:string;viewCount?:string;videoCount?:string};contentDetails:{relatedPlaylists:{uploads:string}}}>}>("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true");
  const channel=channelResponse.items?.[0];if(!channel)throw new Error("The connected Google account does not have a YouTube channel");
  const playlist=await googleJson<{items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:Record<string,{url:string}>;resourceId:{videoId:string}}}>}>(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(channel.contentDetails.relatedPlaylists.uploads)}&maxResults=5`);
  const query=new URLSearchParams({ids:"channel==MINE",startDate:date(28),endDate:date(1),metrics:"views,estimatedMinutesWatched,subscribersGained,likes,comments"});
  const analytics=await googleJson<{rows?:number[][]}>(`https://youtubeanalytics.googleapis.com/v2/reports?${query}`);
  const totals=analytics.rows?.[0]??[0,0,0,0,0],thumbnail=channel.snippet.thumbnails?.high?.url??channel.snippet.thumbnails?.default?.url??null;
  return{id:channel.id,title:channel.snippet.title,description:channel.snippet.description,customUrl:channel.snippet.customUrl??null,thumbnail,subscribers:Number(channel.statistics.subscriberCount??0),views:Number(channel.statistics.viewCount??0),videos:Number(channel.statistics.videoCount??0),uploadsPlaylistId:channel.contentDetails.relatedPlaylists.uploads,recentUploads:(playlist.items??[]).map(item=>({id:item.snippet.resourceId.videoId,title:item.snippet.title,publishedAt:item.snippet.publishedAt,thumbnail:item.snippet.thumbnails?.medium?.url??item.snippet.thumbnails?.default?.url??null})),last28Days:{views:totals[0]??0,watchMinutes:totals[1]??0,subscribersGained:totals[2]??0,likes:totals[3]??0,comments:totals[4]??0},fetchedAt:new Date().toISOString()};
}

export async function safeLiveYouTubeChannel(){try{return{data:await getLiveYouTubeChannel(),error:null}}catch(error){return{data:null,error:error instanceof Error?error.message:"YouTube data could not be loaded"}}}
