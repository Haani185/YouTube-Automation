export const ANALYTICS_WINDOWS = [24, 72, 168, 720] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];
export type AnalyticsSource = "demo" | "youtube";

export type AnalyticsSnapshot = {
  id: string; projectId: string; youtubeVideoId: string | null;
  windowHours: AnalyticsWindow; capturedAt: string; source: AnalyticsSource;
  views: number; estimatedMinutesWatched: number; averageViewDuration: number;
  averageViewPercentage: number; subscribersGained: number; likes: number;
  comments: number; impressions: number | null; impressionCtr: number | null;
};

export type Recommendation = {
  id: string; projectId: string; category: "PACKAGING" | "RETENTION" | "GROWTH";
  finding: string; recommendation: string; confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: Record<string, number | string | null>; status: "PROPOSED" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export const hoursLabel = (hours: number) => hours < 168 ? `${hours}h` : hours === 168 ? "7d" : "30d";

export function validateSnapshot(snapshot: Omit<AnalyticsSnapshot, "id" | "capturedAt">) {
  const counts = [snapshot.views, snapshot.subscribersGained, snapshot.likes, snapshot.comments];
  if (counts.some(value => !Number.isInteger(value) || value < 0)) throw new Error("Analytics counts must be non-negative integers");
  if (snapshot.estimatedMinutesWatched < 0 || snapshot.averageViewDuration < 0) throw new Error("Watch metrics cannot be negative");
  if (snapshot.averageViewPercentage < 0 || snapshot.averageViewPercentage > 100) throw new Error("Average viewed percentage must be between 0 and 100");
  if (snapshot.impressionCtr !== null && (snapshot.impressionCtr < 0 || snapshot.impressionCtr > 100)) throw new Error("Impression CTR must be between 0 and 100");
  return snapshot;
}

export function analyzePerformance(latest: AnalyticsSnapshot, baseline = { impressionCtr: 4.5, averageViewPercentage: 40, subscribersPerThousandViews: 5 }): Omit<Recommendation, "id" | "projectId" | "status" | "createdAt">[] {
  const result: Omit<Recommendation, "id" | "projectId" | "status" | "createdAt">[] = [];
  const ctr = latest.impressionCtr;
  const retention = latest.averageViewPercentage;
  const subsPerThousand = latest.views ? latest.subscribersGained / latest.views * 1000 : 0;
  const confidence = latest.views >= 1000 ? "HIGH" : latest.views >= 200 ? "MEDIUM" : "LOW";
  if (ctr !== null && ctr < baseline.impressionCtr && retention >= baseline.averageViewPercentage) result.push({category:"PACKAGING",finding:"Retention is healthy, but click-through rate trails the baseline.",recommendation:"Test a clearer thumbnail promise and a more specific title while preserving the video content.",confidence,evidence:{windowHours:latest.windowHours,views:latest.views,impressionCtr:ctr,baselineCtr:baseline.impressionCtr,averageViewPercentage:retention}});
  if (ctr !== null && ctr >= baseline.impressionCtr && retention < baseline.averageViewPercentage) result.push({category:"RETENTION",finding:"Packaging earns clicks, but viewers leave earlier than the baseline.",recommendation:"Align the opening with the title promise sooner and shorten setup before the first payoff.",confidence,evidence:{windowHours:latest.windowHours,views:latest.views,impressionCtr:ctr,averageViewPercentage:retention,baselineAverageViewPercentage:baseline.averageViewPercentage}});
  if (retention < baseline.averageViewPercentage && (ctr === null || ctr < baseline.impressionCtr)) result.push({category:"RETENTION",finding:"Both discovery and sustained viewing need improvement.",recommendation:"Treat this as a new experiment: narrow the promise, strengthen the first 30 seconds, and change one packaging variable at a time.",confidence,evidence:{windowHours:latest.windowHours,views:latest.views,impressionCtr:ctr,averageViewPercentage:retention}});
  if (latest.views >= 100 && subsPerThousand < baseline.subscribersPerThousandViews) result.push({category:"GROWTH",finding:"Subscriber conversion is below the working baseline.",recommendation:"Add a topic-specific subscribe reason after the main payoff and connect the next-video recommendation to the same viewer problem.",confidence,evidence:{windowHours:latest.windowHours,views:latest.views,subscribersGained:latest.subscribersGained,subscribersPerThousandViews:Number(subsPerThousand.toFixed(2)),baseline:baseline.subscribersPerThousandViews}});
  return result;
}
