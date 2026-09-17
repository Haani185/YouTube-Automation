import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Communicate } from "edge-tts.js";
import type { Storyboard, StoryboardScene } from "@/domain/storyboard";
import type { VideoFormat } from "@/domain/video-project";
import { planAssets } from "@/domain/assets";
import { saveAsset, type MediaAsset } from "@/infrastructure/asset-repository";

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

export function svgFor(scene: StoryboardScene, format: VideoFormat = "LONG_FORM"): string {
  const isShort = format === "SHORT";
  const narration = scene.narration.length > 180 ? `${scene.narration.slice(0, 177)}…` : scene.narration;
  const overlay = scene.overlay || "KEY INSIGHT";
  const visualLabel = scene.visualType.replaceAll("_", " ");

  if (isShort) {
    // 9:16 Vertical layout (1080x1920) optimized for YouTube Shorts
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a0d14"/>
          <stop offset="40%" stop-color="#141926"/>
          <stop offset="100%" stop-color="#2a1219"/>
        </linearGradient>
        <linearGradient id="accentGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff4d57"/>
          <stop offset="100%" stop-color="#ff8a4c"/>
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)"/>
      <circle cx="900" cy="300" r="380" fill="#ff4d57" opacity="0.12"/>
      <circle cx="150" cy="1500" r="320" fill="#ff8a4c" opacity="0.1"/>

      <!-- Header badge -->
      <rect x="90" y="160" width="340" height="64" rx="32" fill="#1e2433" stroke="#ff4d57" stroke-width="2"/>
      <text x="260" y="202" text-anchor="middle" fill="#ff755f" font-family="system-ui, -apple-system, Arial" font-size="26" font-weight="700">SCENE ${scene.order} · SHORTS</text>

      <!-- Center focus card -->
      <g filter="url(#shadow)">
        <rect x="80" y="380" width="920" height="840" rx="36" fill="#131722" stroke="#2b3245" stroke-width="2"/>
        <rect x="80" y="380" width="920" height="12" rx="6" fill="url(#accentGlow)"/>
        <text x="140" y="470" fill="#ff8a4c" font-family="system-ui, -apple-system, Arial" font-size="30" font-weight="800" letter-spacing="2">${escapeXml(visualLabel)}</text>
        <text x="140" y="580" fill="#ffffff" font-family="system-ui, -apple-system, Arial" font-size="62" font-weight="900">${escapeXml(overlay)}</text>
        <line x1="140" y1="640" x2="340" y2="640" stroke="#ff4d57" stroke-width="6" stroke-linecap="round"/>
        <foreignObject x="140" y="690" width="800" height="480">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font:42px -apple-system, system-ui, Arial;line-height:1.5;font-weight:500;">
            ${escapeXml(narration)}
          </div>
        </foreignObject>
      </g>

      <!-- Safe area lower tag -->
      <rect x="80" y="1300" width="920" height="180" rx="28" fill="#1a202c" opacity="0.9" stroke="#334155" stroke-width="1.5"/>
      <text x="130" y="1370" fill="#94a3b8" font-family="system-ui, -apple-system, Arial" font-size="28" font-weight="600">VERIFIED RESEARCH</text>
      <text x="130" y="1430" fill="#f8fafc" font-family="system-ui, -apple-system, Arial" font-size="36" font-weight="700">Source-Grounded Production</text>
    </svg>`;
  }

  // 16:9 Widescreen layout (1920x1080) for standard YouTube Long-Form
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#080b11"/>
        <stop offset="60%" stop-color="#111622"/>
        <stop offset="100%" stop-color="#2d131a"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#151b28" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#0f131c" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="accentGlow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ff4d57"/>
        <stop offset="100%" stop-color="#ff8a4c"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.7"/>
      </filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#bg)"/>
    <circle cx="1680" cy="180" r="360" fill="#ff4d57" opacity="0.14"/>
    <circle cx="240" cy="940" r="280" fill="#ff8a4c" opacity="0.08"/>

    <!-- Top Badge -->
    <rect x="120" y="90" width="380" height="54" rx="27" fill="#1a202c" stroke="#ff4d57" stroke-width="2"/>
    <text x="310" y="126" text-anchor="middle" fill="#ff755f" font-family="system-ui, -apple-system, Arial" font-size="24" font-weight="700">SCENE ${scene.order} · ${escapeXml(visualLabel)}</text>

    <!-- Main Card -->
    <g filter="url(#shadow)">
      <rect x="120" y="180" width="1680" height="780" rx="32" fill="url(#cardGrad)" stroke="#262f44" stroke-width="2"/>
      <rect x="120" y="180" width="1680" height="8" rx="4" fill="url(#accentGlow)"/>

      <text x="180" y="290" fill="#ff8a4c" font-family="system-ui, -apple-system, Arial" font-size="32" font-weight="800" letter-spacing="2">KEY TAKEAWAY</text>
      <text x="180" y="380" fill="#ffffff" font-family="system-ui, -apple-system, Arial" font-size="68" font-weight="900">${escapeXml(overlay)}</text>
      <line x1="180" y1="420" x2="380" y2="420" stroke="#ff4d57" stroke-width="6" stroke-linecap="round"/>

      <foreignObject x="180" y="470" width="1560" height="420">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font:44px -apple-system, system-ui, Arial;line-height:1.5;font-weight:400;">
          ${escapeXml(narration)}
        </div>
      </foreignObject>
    </g>

    <!-- Footer provenance -->
    <text x="1780" y="1020" text-anchor="end" fill="#64748b" font-family="system-ui, -apple-system, Arial" font-size="22" font-weight="500">AUDITABLE AI PIPELINE · SOURCE GROUNDED</text>
  </svg>`;
}

function synthesizeNarration(dir: string, text: string): string | null {
  const input = resolve(dir, "narration.txt");
  const output = resolve(dir, "narration.wav");
  const script = resolve(dir, "create-narration.ps1");
  writeFileSync(input, text, "utf8");
  writeFileSync(
    script,
    `Add-Type -AssemblyName System.Speech\n$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$s.Rate = 0\n$s.Volume = 100\n$s.SetOutputToWaveFile($args[1])\n$s.Speak([System.IO.File]::ReadAllText($args[0]))\n$s.Dispose()\n`,
    "utf8"
  );
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, input, output], {
    encoding: "utf8",
    timeout: 120_000,
  });
  return result.status === 0 && existsSync(output) && statSync(output).size > 0 ? output : null;
}

async function createFreeVoice(dir: string, text: string) {
  const online = resolve(dir, "narration.mp3");
  try {
    await new Communicate(text, process.env.FREE_TTS_VOICE || "en-US-AriaNeural", {
      rate: "+0%",
      volume: "+0%",
      pitch: "+0Hz",
    }).save(online);
    if (!existsSync(online) || statSync(online).size === 0) throw new Error("Voice service returned no audio");
    return {
      path: online,
      filename: "narration.mp3",
      provider: "edge-tts-free",
      mimeType: "audio/mpeg",
      provenance: "Free neural narration generated through Microsoft Edge Read Aloud; no API key or paid account required",
    };
  } catch {
    if (existsSync(online)) unlinkSync(online);
    const offline = synthesizeNarration(dir, text);
    if (offline)
      return {
        path: offline,
        filename: "narration.wav",
        provider: "windows-offline-tts",
        mimeType: "audio/wav",
        provenance: "Free offline narration generated with the built-in Windows speech engine",
      };
    return null;
  }
}

async function tryFetchStockImage(query: string, dir: string, filename: string): Promise<boolean> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { photos?: Array<{ src?: { large2x?: string } }> };
    const photoUrl = data.photos?.[0]?.src?.large2x;
    if (!photoUrl) return false;

    const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return false;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(resolve(dir, filename.replace(".svg", ".jpg")), buffer);
    return true;
  } catch {
    return false;
  }
}

export async function generateLocalAssets(
  projectId: string,
  storyboard: Storyboard,
  format: VideoFormat = storyboard.format ?? "LONG_FORM"
): Promise<MediaAsset[]> {
  const dir = resolve("public", "generated", projectId);
  mkdirSync(dir, { recursive: true });
  const requirements = planAssets(storyboard);
  const assets: MediaAsset[] = [];

  for (const req of requirements) {
    if (req.kind === "VISUAL") {
      const scene = storyboard.scenes.find((s) => s.id === req.sceneId)!;
      const content = svgFor(scene, format);
      const filename = `${scene.id}.svg`;
      writeFileSync(resolve(dir, filename), content, "utf8");

      let finalUri = `/generated/${projectId}/${filename}`;
      let finalMime = "image/svg+xml";
      let finalProvenance = `Local branded ${format === "SHORT" ? "9:16 Shorts" : "16:9 Full HD"} SVG visual`;

      // Optional stock enhancement if configured
      if (process.env.PEXELS_API_KEY) {
        const query = scene.visualPrompt || scene.narration.slice(0, 50);
        const gotStock = await tryFetchStockImage(query, dir, filename);
        if (gotStock) {
          finalUri = `/generated/${projectId}/${filename.replace(".svg", ".jpg")}`;
          finalMime = "image/jpeg";
          finalProvenance = "Licensed royalty-free stock imagery via Pexels API";
        }
      }

      assets.push(
        saveAsset(projectId, {
          ...req,
          assetKind: req.kind,
          status: "READY",
          uri: finalUri,
          provenance: finalProvenance,
          mimeType: finalMime,
          actualCostUsd: 0,
          content,
        })
      );
    } else {
      const text = storyboard.scenes.map((s) => s.narration).join(" ");
      const audio = await createFreeVoice(dir, text);
      const content = JSON.stringify(
        {
          voice: audio?.provider ?? "silent fallback",
          wordsPerMinute: storyboard.wordsPerMinute,
          format,
          segments: storyboard.scenes.map((s) => ({
            sceneId: s.id,
            text: s.narration,
            durationSeconds: s.durationSeconds,
          })),
        },
        null,
        2
      );
      writeFileSync(resolve(dir, "narration-manifest.json"), content, "utf8");
      assets.push(
        saveAsset(projectId, {
          ...req,
          provider: audio?.provider ?? "ffmpeg-silence-fallback",
          assetKind: req.kind,
          status: "READY",
          uri: audio ? `/generated/${projectId}/${audio.filename}` : `/generated/${projectId}/narration-manifest.json`,
          provenance: audio?.provenance ?? "Voice services unavailable; renderer will use a free local silent fallback",
          mimeType: audio?.mimeType ?? "application/json",
          actualCostUsd: 0,
          content: audio ? readFileSync(audio.path).toString("base64") : content,
        })
      );
    }
  }
  return assets;
}
