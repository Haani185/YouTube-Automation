import {randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {authorizationUrl} from "@/infrastructure/youtube-auth";
export const runtime="nodejs";
export async function GET(){const state=randomBytes(24).toString("hex");(await cookies()).set("youtube_oauth_state",state,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:600,path:"/"});return Response.redirect(authorizationUrl(state));}
