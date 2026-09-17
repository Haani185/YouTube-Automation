import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { Storyboard, StoryboardScene } from "@/domain/storyboard";
import type { VideoFormat } from "@/domain/video-project";
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

function rasterizeScene(scene: StoryboardScene, path: string, isShort: boolean) {
  const width = isShort ? 540 : 960;
  const height = isShort ? 960 : 540;
  const pixels = Buffer.alloc(width * height * 3);
  const accent = [233, 59, 71];
  const seed = scene.order * 37;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const t = x / width;
      const u = y / height;
      const glow = Math.max(0, 1 - Math.hypot(t - (isShort ? 0.5 : 0.82), u - 0.2) * 2.4);
      const band = y > height * 0.72 && y < height * 0.78 ? 1 : 0;

      pixels[offset] = Math.round(11 + 24 * t + accent[0] * glow * 0.16 + accent[0] * band * 0.55);
      pixels[offset + 1] = Math.round(14 + 10 * t + accent[1] * glow * 0.08 + accent[1] * band * 0.18);
      pixels[offset + 2] = Math.round(20 + 18 * t + accent[2] * glow * 0.1 + accent[2] * band * 0.2);

      // Accent visual indicator bar
      const barY = isShort ? 380 + (seed % 60) : 245 + (seed % 45);
      if (x > 60 && x < 60 + Math.min(width - 120, 180 + scene.narration.length * 3) && y > barY && y < barY + 16) {
        pixels[offset] = 233;
        pixels[offset + 1] = 59;
        pixels[offset + 2] = 71;
      }
    }
  }
  writeFileSync(path, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]));
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
    const raster = resolve(out, `${s.id}.ppm`);
    const target = resolve(out, `${s.id}.mp4`);
    rasterizeScene(s, raster, isShort);
    run(ffmpeg, [
      "-y",
      "-loop",
      "1",
      "-i",
      raster,
      "-t",
      String(s.durationSeconds),
      "-vf",
      `scale=${targetWidth}:${targetHeight},format=yuv420p`,
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
