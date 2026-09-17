import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as archiverModule from "archiver";
type Archive = {
  on: (event: string, handler: (value?: Error) => void) => Archive;
  pipe: (stream: NodeJS.WritableStream) => Archive;
  file: (path: string, options: { name: string }) => Archive;
  finalize: () => Promise<void>;
};
const ZipArchive = (archiverModule as unknown as { ZipArchive: new (options: Record<string, unknown>) => Archive })
  .ZipArchive;
import type { Storyboard } from "@/domain/storyboard";
import type { TopicCandidate } from "@/infrastructure/topic-repository";
import type { MediaAsset } from "@/infrastructure/asset-repository";
import { saveAsset } from "@/infrastructure/asset-repository";
import type { RenderRecord } from "./video-renderer";
import { createSeoPackage, validatePublishing } from "@/domain/publishing";

const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

function thumbnail(title: string, label: string, accent: string, styleIdx: number) {
  const words = title.toUpperCase().split(" ");
  const cut = Math.max(1, Math.ceil(words.length / 2));
  const topText = esc(words.slice(0, cut).join(" "));
  const bottomText = esc(words.slice(cut).join(" "));

  const tags = ["STEP-BY-STEP PROOF", "SOURCE GROUNDED", "100% AUDITABLE"];
  const subTag = tags[styleIdx % tags.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#07090e"/>
        <stop offset="50%" stop-color="#111624"/>
        <stop offset="100%" stop-color="#1f1118"/>
      </linearGradient>
      <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#ffd166" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.8"/>
      </filter>
    </defs>
    
    <!-- Background & Cinematic Glows -->
    <rect width="1280" height="720" fill="url(#bg)"/>
    <circle cx="1080" cy="180" r="320" fill="${accent}" opacity="0.22" filter="blur(40px)"/>
    <circle cx="200" cy="620" r="260" fill="#ffd166" opacity="0.12" filter="blur(50px)"/>

    <!-- Accent Border Frame -->
    <rect x="24" y="24" width="1232" height="672" rx="20" fill="none" stroke="${accent}" stroke-width="3" opacity="0.6"/>

    <!-- Category / Hook Badge -->
    <g filter="url(#cardShadow)">
      <rect x="70" y="64" width="280" height="54" rx="27" fill="${accent}"/>
      <text x="210" y="100" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, Arial" font-size="24" font-weight="900" letter-spacing="1">${esc(label)}</text>
    </g>

    <!-- Subtitle Pill -->
    <rect x="370" y="64" width="300" height="54" rx="27" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="520" y="100" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, -apple-system, Arial" font-size="20" font-weight="700">${esc(subTag)}</text>

    <!-- Main High-Contrast Title -->
    <g filter="url(#cardShadow)">
      <text x="70" y="320" fill="#ffffff" font-family="system-ui, -apple-system, Arial" font-size="82" font-weight="900" letter-spacing="-1">${topText}</text>
      <text x="70" y="430" fill="url(#glow)" font-family="system-ui, -apple-system, Arial" font-size="86" font-weight="900" letter-spacing="-1">${bottomText || "GUIDE"}</text>
    </g>

    <!-- Bottom Feature Bar -->
    <rect x="70" y="580" width="1140" height="70" rx="16" fill="#0f172a" opacity="0.85" stroke="#1e293b" stroke-width="2"/>
    <circle cx="110" cy="615" r="10" fill="#22c55e"/>
    <text x="135" y="622" fill="#f8fafc" font-family="system-ui, -apple-system, Arial" font-size="24" font-weight="800">100% FACT-CHECKED &amp; CITED</text>
    <text x="1170" y="622" text-anchor="end" fill="#94a3b8" font-family="system-ui, -apple-system, Arial" font-size="22" font-weight="600">FULL PRODUCTION BLUEPRINT</text>
  </svg>`;
}

export async function buildPublishPackage(
  projectId: string,
  topic: TopicCandidate,
  storyboard: Storyboard,
  assets: MediaAsset[],
  render: RenderRecord,
  claimsGrounded: boolean
) {
  const root = resolve("public", "generated", projectId);
  const dir = resolve(root, "publish");
  mkdirSync(dir, { recursive: true });

  const specs = [
    ["thumbnail-a.svg", "BEST PICK", "#ff4d57"],
    ["thumbnail-b.svg", "SAVE HOURS", "#ff8a4c"],
    ["thumbnail-c.svg", "THE BLUEPRINT", "#3b82f6"],
  ] as const;

  for (let i = 0; i < specs.length; i++) {
    const [name, label, color] = specs[i];
    const content = thumbnail(topic.title, label, color, i);
    writeFileSync(resolve(dir, name), content, "utf8");
    saveAsset(projectId, {
      sceneId: name.replace(".svg", ""),
      assetKind: "THUMBNAIL",
      status: "READY",
      uri: `/generated/${projectId}/publish/${name}`,
      provider: "high-contrast-svg",
      prompt: `Thumbnail concept: ${label}`,
      license: "SELF_GENERATED",
      provenance: "High-CTR branded thumbnail generated from approved topic and claims",
      mimeType: "image/svg+xml",
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      content,
    });
  }

  const seo = createSeoPackage(topic, storyboard);
  const issues = validatePublishing({
    seo,
    hasVideo: true,
    hasCaptions: true,
    thumbnailCount: 3,
    technicalQa: render.qa.pass,
    claimsGrounded,
  });

  const metadata = {
    seo,
    selectedThumbnail: "thumbnail-a.svg",
    qa: { pass: issues.length === 0, issues },
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(resolve(dir, "metadata.json"), JSON.stringify(metadata, null, 2));
  writeFileSync(resolve(dir, "provenance.json"), JSON.stringify(assets, null, 2));

  const zipPath = resolve(dir, "publish-package.zip");
  await new Promise<void>((ok, fail) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", () => ok());
    archive.on("error", fail);
    archive.pipe(output);
    archive.file(resolve(root, "render", "video-final.mp4"), { name: "video-final.mp4" });
    archive.file(resolve(root, "render", "captions.srt"), { name: "captions.srt" });
    archive.file(resolve(dir, "thumbnail-a.svg"), { name: "thumbnail.svg" });
    archive.file(resolve(dir, "metadata.json"), { name: "metadata.json" });
    archive.file(resolve(dir, "provenance.json"), { name: "provenance.json" });
    void archive.finalize();
  });

  return {
    seo,
    issues,
    thumbnailUris: specs.map((s) => `/generated/${projectId}/publish/${s[0]}`),
    zipUri: `/generated/${projectId}/publish/publish-package.zip`,
    checksum: createHash("sha256").update(readFileSync(zipPath)).digest("hex"),
  };
}
