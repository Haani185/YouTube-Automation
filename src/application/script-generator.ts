import type { Claim, ResearchSource } from "@/infrastructure/research-repository";
import type { TopicCandidate } from "@/infrastructure/topic-repository";
import type { VideoFormat } from "@/domain/video-project";

export type ScriptSection = {
  heading: string;
  narration: string;
  claimIds: string[];
};

export type ScriptDraft = {
  title: string;
  estimatedMinutes: number;
  sections: ScriptSection[];
  wordCount: number;
  format?: VideoFormat;
};

export type ScriptOptions = {
  targetDurationMinutes?: number;
  format?: VideoFormat;
  tone?: string;
  prohibitedTopics?: string;
};

export function updateScriptDraft(
  draft: ScriptDraft,
  sectionIndex: number,
  heading: string,
  narration: string
): ScriptDraft {
  if (sectionIndex < 0 || sectionIndex >= draft.sections.length) {
    throw new Error(`Invalid section index: ${sectionIndex}`);
  }
  const updatedSections = draft.sections.map((sec, idx) =>
    idx === sectionIndex ? { ...sec, heading: heading.trim(), narration: narration.trim() } : sec
  );
  const wordCount = updatedSections.reduce((sum, sec) => sum + sec.narration.split(/\s+/).filter(Boolean).length, 0);
  return {
    ...draft,
    sections: updatedSections,
    wordCount,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 145)),
  };
}

export function generateDeterministicScript(
  topic: TopicCandidate,
  claims: Claim[],
  sources: ResearchSource[],
  options: ScriptOptions = {}
): ScriptDraft {
  const supported = claims.filter((c) => c.supportStatus === "SUPPORTED" && c.sourceId);
  if (!supported.length) throw new Error("At least one source-backed supported claim is required");

  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const format = options.format ?? "LONG_FORM";
  const targetMinutes = options.targetDurationMinutes ?? (format === "SHORT" ? 1 : 8);

  if (format === "SHORT" || targetMinutes <= 1) {
    // Punchy, fast-paced script for YouTube Shorts (<60s)
    const primaryClaim = supported[0];
    const sourceInfo = sourceMap.get(primaryClaim.sourceId!)?.publisher ?? "verified research";
    const sections: ScriptSection[] = [
      {
        heading: "Hook",
        narration: `${topic.hook} Most people get this completely backward.`,
        claimIds: [],
      },
      {
        heading: "The Core Fact",
        narration: `Here is what the evidence actually proves: ${primaryClaim.claimText}. According to ${sourceInfo}, ${primaryClaim.evidence}`,
        claimIds: [primaryClaim.id],
      },
      {
        heading: "The Takeaway",
        narration: `If you want to stay ahead in ${topic.audience.toLowerCase()}, test this yourself today. Subscribe for more practical breakdowns.`,
        claimIds: [],
      },
    ];
    const wordCount = sections.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
    return {
      title: topic.title,
      estimatedMinutes: 1,
      sections,
      wordCount,
      format: "SHORT",
    };
  }

  // Long-form video: Scale sections according to target minutes
  const sections: ScriptSection[] = [
    {
      heading: "Hook & Core Thesis",
      narration: `${topic.hook} In this video, we're breaking down the data, the exact methodology, and what it means for ${topic.audience.toLowerCase()}.`,
      claimIds: [],
    },
    {
      heading: "The Current Landscape",
      narration: `There is a lot of noise around this topic, but reliable decisions require verifiable facts. To understand where the industry is heading, we investigated the underlying research and verified the claims before automating anything.`,
      claimIds: [],
    },
  ];

  supported.forEach((claim, idx) => {
    const publisher = sourceMap.get(claim.sourceId!)?.publisher ?? "the primary source";
    sections.push({
      heading: `Evidence Deep-Dive ${idx + 1}`,
      narration: `Examining claim number ${idx + 1}: ${claim.claimText} Documented by ${publisher}, the data shows that ${claim.evidence} This provides an empirical benchmark that creators and builders can rely on.`,
      claimIds: [claim.id],
    });
  });

  sections.push({
    heading: "Practical Implementation",
    narration: `Knowing the facts is only half the battle. Here is how you can apply this immediately: start with a focused single-variable test, document your baseline metrics, and confirm your assumptions before scaling up production.`,
    claimIds: [],
  });

  if (targetMinutes >= 6) {
    sections.push({
      heading: "Common Pitfalls to Avoid",
      narration: `Many creators make the mistake of adopting conclusions without checking the original context. Always maintain source provenance, verify licensing compliance, and keep human editorial approval before deploying automated workflows.`,
      claimIds: [],
    });
  }

  sections.push({
    heading: "Summary & Action Step",
    narration: `To recap: ${topic.rationale}. If you found this breakdown valuable, explore the verified sources linked in the description, subscribe for more source-grounded guides, and leave your thoughts in the comments below.`,
    claimIds: [],
  });

  const wordCount = sections.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  return {
    title: topic.title,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 145)),
    sections,
    wordCount,
    format: "LONG_FORM",
  };
}

async function generateGeminiScript(
  topic: TopicCandidate,
  claims: Claim[],
  sources: ResearchSource[],
  options: ScriptOptions
): Promise<ScriptDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const supported = claims.filter((c) => c.supportStatus === "SUPPORTED" && c.sourceId);
  const targetMinutes = options.targetDurationMinutes ?? (options.format === "SHORT" ? 1 : 8);
  const targetWords = targetMinutes * 145;

  const prompt = `You are an expert YouTube scriptwriter.
Generate a structured, source-grounded YouTube video script.
Target duration: ${targetMinutes} minutes (approximately ${targetWords} words total).
Format: ${options.format ?? "LONG_FORM"}.
Tone: ${options.tone ?? "Authoritative, engaging, accessible, and source-grounded"}.

Topic: ${topic.title}
Hook: ${topic.hook}
Target Audience: ${topic.audience}
Supported Claims:
${supported.map((c) => `- [ID: ${c.id}] ${c.claimText} (Evidence: ${c.evidence})`).join("\n")}

Rules:
1. Every factual statement must cite one of the Claim IDs above.
2. Return a valid JSON object matching this schema:
{
  "title": "${topic.title}",
  "sections": [
    {
      "heading": "Section Title",
      "narration": "Full narration text to be spoken by the voiceover.",
      "claimIds": ["claim-id-if-referenced"]
    }
  ]
}
Return ONLY pure JSON.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error (${res.status})`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned empty text");

  const parsed = JSON.parse(rawText) as {
    title?: string;
    sections: Array<{ heading: string; narration: string; claimIds?: string[] }>;
  };

  const sections: ScriptSection[] = parsed.sections.map((s) => ({
    heading: s.heading,
    narration: s.narration,
    claimIds: s.claimIds ?? [],
  }));
  const wordCount = sections.reduce((sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length, 0);

  return {
    title: parsed.title || topic.title,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 145)),
    sections,
    wordCount,
    format: options.format,
  };
}

async function generateOpenAIScript(
  topic: TopicCandidate,
  claims: Claim[],
  sources: ResearchSource[],
  options: ScriptOptions
): Promise<ScriptDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const supported = claims.filter((c) => c.supportStatus === "SUPPORTED" && c.sourceId);
  const targetMinutes = options.targetDurationMinutes ?? (options.format === "SHORT" ? 1 : 8);
  const targetWords = targetMinutes * 145;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `You are an elite YouTube scriptwriter. Create an engaging, source-grounded script for YouTube. Output JSON only. Target duration: ${targetMinutes} minutes (~${targetWords} words).`,
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: topic.title,
            hook: topic.hook,
            audience: topic.audience,
            supportedClaims: supported,
            format: options.format ?? "LONG_FORM",
          }),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error (${res.status})`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  const parsed = JSON.parse(content) as {
    title?: string;
    sections: Array<{ heading: string; narration: string; claimIds?: string[] }>;
  };

  const sections: ScriptSection[] = parsed.sections.map((s) => ({
    heading: s.heading,
    narration: s.narration,
    claimIds: s.claimIds ?? [],
  }));
  const wordCount = sections.reduce((sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length, 0);

  return {
    title: parsed.title || topic.title,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 145)),
    sections,
    wordCount,
    format: options.format,
  };
}

export async function generateGroundedScript(
  topic: TopicCandidate,
  claims: Claim[],
  sources: ResearchSource[],
  options: ScriptOptions = {}
): Promise<ScriptDraft> {
  const provider = process.env.AI_PROVIDER;
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      return await generateGeminiScript(topic, claims, sources, options);
    } catch {
      // Fallback gracefully
    }
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await generateOpenAIScript(topic, claims, sources, options);
    } catch {
      // Fallback gracefully
    }
  }

  return generateDeterministicScript(topic, claims, sources, options);
}
