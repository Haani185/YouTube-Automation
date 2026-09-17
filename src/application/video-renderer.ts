import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { Storyboard, StoryboardScene } from "../domain/storyboard.ts";
import type { VideoFormat } from "../domain/video-project.ts";
import { db } from "../infrastructure/database.ts";

const require = createRequire(import.meta.url);
const ffmpeg = (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
const ffprobe = (require("@ffprobe-installer/ffprobe") as { path: string }).path;

export type RenderRecord = {
  id: string;
  videoUri: string;
  captionsUri: string;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
  qa: { pass: boolean; checks: Record<string, boolean> };
  checksum: string;
  createdAt: string;
};

const stamp = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
};

function run(binary: string, args: string[]) {
  const r = spawnSync(binary, args, { encoding: "utf8", maxBuffer: 10_000_000 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "Media command failed").slice(-2000));
  return r.stdout;
}

function isReadableAudio(path: string) {
  if (!existsSync(path)) return false;
  const probe = spawnSync(
    ffprobe,
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
    { encoding: "utf8", timeout: 15_000 }
  );
  return probe.status === 0 && probe.stdout.trim() === "audio";
}


function renderSceneClip(
  scene: StoryboardScene,
  root: string,
  out: string,
  targetWidth: number,
  targetHeight: number,
  isShort: boolean
): string {
  const target = resolve(out, `${scene.id}.mp4`);
  const videoFile = resolve(root, `${scene.id}.mp4`);
  const imageJpg = resolve(root, `${scene.id}.jpg`);
  const imagePng = resolve(root, `${scene.id}.png`);

  const duration = Math.max(1, scene.durationSeconds);
  const totalFrames = Math.round(duration * 30);

  const badgeFile = resolve(out, `${scene.id}-badge.txt`);
  const overlayFile = resolve(out, `${scene.id}-overlay.txt`);
  const narrFile = resolve(out, `${scene.id}-narr.txt`);

  writeFileSync(badgeFile, `SCENE ${scene.order} · ${isShort ? "SHORTS" : "KEY TAKEAWAY"}`, "utf8");
  writeFileSync(overlayFile, scene.overlay || scene.visualType.replaceAll("_", " "), "utf8");
  writeFileSync(
    narrFile,
    scene.narration.length > 95 ? `${scene.narration.slice(0, 92)}...` : scene.narration,
    "utf8"
  );

  const safeBadge = badgeFile.replaceAll("\\", "/").replace(":", "\\:");
  const safeOverlay = overlayFile.replaceAll("\\", "/").replace(":", "\\:");
  const safeNarr = narrFile.replaceAll("\\", "/").replace(":", "\\:");

  // 1. Real Video Footage (e.g. from Pexels stock video)
  if (existsSync(videoFile) && statSync(videoFile).size > 1000) {
    run(ffmpeg, [
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      videoFile,
      "-t",
      String(duration),
      "-vf",
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},format=rgba,drawbox=x=0:y=${Math.round(targetHeight * 0.72)}:w=${targetWidth}:h=${Math.round(targetHeight * 0.28)}:color=0x000000aa:t=fill,drawtext=textfile='${safeBadge}':fontsize=${isShort ? 28 : 24}:fontcolor=0xff755f:x=${isShort ? 70 : 120}:y=${Math.round(targetHeight * 0.76)},drawtext=textfile='${safeOverlay}':fontsize=${isShort ? 52 : 46}:fontcolor=white:x=${isShort ? 70 : 120}:y=${Math.round(targetHeight * 0.83)},format=yuv420p`,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-an",
      target,
    ]);
    return target;
  }

  // 2. High-resolution AI Image (e.g. from Pollinations AI or stock photo) with Ken Burns motion!
  if (
    (existsSync(imageJpg) && statSync(imageJpg).size > 1000) ||
    (existsSync(imagePng) && statSync(imagePng).size > 1000)
  ) {
    const imgPath = existsSync(imageJpg) ? imageJpg : imagePng;
    const zoomFilter = `zoompan=z='min(zoom+0.0012,1.18)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetWidth}x${targetHeight}:fps=30`;
    const overlayFilter = `format=rgba,drawbox=x=0:y=${Math.round(targetHeight * 0.72)}:w=${targetWidth}:h=${Math.round(targetHeight * 0.28)}:color=0x000000bb:t=fill,drawtext=textfile='${safeBadge}':fontsize=${isShort ? 28 : 24}:fontcolor=0xff755f:x=${isShort ? 70 : 120}:y=${Math.round(targetHeight * 0.76)},drawtext=textfile='${safeOverlay}':fontsize=${isShort ? 52 : 46}:fontcolor=white:x=${isShort ? 70 : 120}:y=${Math.round(targetHeight * 0.83)},format=yuv420p`;

    run(ffmpeg, [
      "-y",
      "-loop",
      "1",
      "-i",
      imgPath,
      "-t",
      String(duration),
      "-vf",
      `${zoomFilter},${overlayFilter}`,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-an",
      target,
    ]);
    return target;
  }

  // 3. Fallback: Procedural motion canvas with rich typography and accent styling
  const cardX = isShort ? 60 : 120;
  const cardY = isShort ? 280 : 160;
  const cardW = targetWidth - (isShort ? 120 : 240);
  const cardH = targetHeight - (isShort ? 560 : 320);

  const filter = `color=c=0x0a0e17:s=${targetWidth}x${targetHeight}:d=${duration},format=rgba,drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=0x141b2dee:t=fill,drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=10:color=0xff4d57ff:t=fill,drawtext=textfile='${safeBadge}':fontsize=${isShort ? 28 : 26}:fontcolor=0xff755f:x=${cardX + 40}:y=${cardY + 50},drawtext=textfile='${safeOverlay}':fontsize=${isShort ? 52 : 48}:fontcolor=white:x=${cardX + 40}:y=${cardY + 120},drawtext=textfile='${safeNarr}':fontsize=${isShort ? 32 : 28}:fontcolor=0xcbd5e1:x=${cardX + 40}:y=${cardY + 220},format=yuv420p`;

  run(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    filter,
    "-t",
    String(duration),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-an",
    target,
  ]);
  return target;
}

export function renderDemoVideo(
  projectId: string,
  storyboard: Storyboard,
  format: VideoFormat = storyboard.format ?? "LONG_FORM"
): RenderRecord {
  const root = resolve("public", "generated", projectId);
  const out = resolve(root, "render");
  mkdirSync(out, { recursive: true });
  let cursor = 0;

  const isShort = format === "SHORT";
  const targetWidth = isShort ? 1080 : 1920;
  const targetHeight = isShort ? 1920 : 1080;

  // Generate captions SRT
  const srt = storyboard.scenes
    .map((s, i) => {
      const start = cursor;
      cursor += s.durationSeconds;
      return `${i + 1}\n${stamp(start)} --> ${stamp(cursor)}\n${s.narration}\n`;
    })
    .join("\n");
  writeFileSync(resolve(out, "captions.srt"), srt, "utf8");

  // Generate individual MP4 clips for each scene
  const clips = storyboard.scenes.map((s) => {
    return renderSceneClip(s, root, out, targetWidth, targetHeight, isShort);
  });

  const concat = clips.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n");
  writeFileSync(resolve(out, "concat.txt"), concat, "utf8");
  const video = resolve(out, "video-final.mp4");

  const narration = [resolve(root, "narration.mp3"), resolve(root, "narration.wav")].find(isReadableAudio);
  const ambientTrack = [
    resolve("public", "audio", "ambient.aac"),
    resolve("public", "audio", "ambient.mp3"),
  ].find(isReadableAudio);

  let audioArgs: string[] = [];
  if (narration && ambientTrack) {
    // Vocal + Ambient Music with 15% volume auto-ducking under voiceover
    audioArgs = [
      "-i",
      narration,
      "-stream_loop",
      "-1",
      "-i",
      ambientTrack,
      "-filter_complex",
      "[1:a]volume=1.0,apad[vocal]; [2:a]volume=0.14[bgm]; [vocal][bgm]amix=inputs=2:duration=first:dropout_transition=1[aout]",
      "-map",
      "0:v",
      "-map",
      "[aout]",
    ];
  } else if (narration) {
    audioArgs = ["-i", narration, "-af", "apad"];
  } else {
    audioArgs = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  }

  run(ffmpeg, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    resolve(out, "concat.txt"),
    ...audioArgs,
    "-t",
    String(storyboard.totalDurationSeconds),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    video,
  ]);

  const probe = JSON.parse(
    run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", video])
  ) as {
    streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number }>;
    format: { duration: string };
  };

  const v = probe.streams.find((s) => s.codec_type === "video")!;
  const a = probe.streams.find((s) => s.codec_type === "audio")!;
  const duration = Number(probe.format.duration);

  const isCorrectRes = isShort
    ? v.width === 1080 && v.height === 1920
    : v.width === 1920 && v.height === 1080;

  const checks = {
    h264: v.codec_name === "h264",
    aac: a?.codec_name === "aac",
    fullHd: isCorrectRes,
    duration: Math.abs(duration - storyboard.totalDurationSeconds) < 1,
    captions: srt.length > 0,
  };

  const qa = { pass: Object.values(checks).every(Boolean), checks };
  const now = new Date().toISOString();
  const id = randomUUID();
  const checksum = createHash("sha256").update(readFileSync(video)).digest("hex");
  const uri = `/generated/${projectId}/render/video-final.mp4`;
  const captionsUri = `/generated/${projectId}/render/captions.srt`;

  db.prepare("INSERT INTO renders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    id,
    projectId,
    qa.pass ? "PASSED" : "FAILED",
    uri,
    captionsUri,
    duration,
    v.width ?? 0,
    v.height ?? 0,
    v.codec_name,
    a?.codec_name ?? "",
    JSON.stringify(qa),
    checksum,
    now
  );

  return {
    id,
    videoUri: uri,
    captionsUri,
    durationSeconds: duration,
    width: v.width ?? 0,
    height: v.height ?? 0,
    videoCodec: v.codec_name,
    audioCodec: a?.codec_name ?? "",
    qa,
    checksum,
    createdAt: now,
  };
}

export function listRenders(projectId: string): RenderRecord[] {
  return (
    db.prepare("SELECT * FROM renders WHERE project_id=? ORDER BY created_at DESC").all(projectId) as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: r.id as string,
    videoUri: r.video_uri as string,
    captionsUri: r.captions_uri as string,
    durationSeconds: r.duration_seconds as number,
    width: r.width as number,
    height: r.height as number,
    videoCodec: r.video_codec as string,
    audioCodec: r.audio_codec as string,
    qa: JSON.parse(r.qa_json as string),
    checksum: r.checksum as string,
    createdAt: r.created_at as string,
  }));
}
