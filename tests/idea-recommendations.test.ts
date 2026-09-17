import test from "node:test";
import assert from "node:assert/strict";
import {recommendChannelIdeas} from "../src/application/idea-recommendations.ts";

test("creates five recommendations grounded in channel setup",()=>{
  const ideas=recommendChannelIdeas({channelName:"Test",niche:"home gardening",targetAudience:"apartment beginners",language:"English",timezone:"UTC",defaultDurationMinutes:8,weeklyFrequency:1,tone:"friendly",visualStyle:"clean",brandColors:"green",narratorStyle:"warm",prohibitedTopics:"none",updatedAt:new Date(0).toISOString()});
  assert.equal(ideas.length,5);
  assert.equal(new Set(ideas.map(idea=>idea.title)).size,5);
  assert.ok(ideas.every(idea=>idea.title.includes("home gardening")));
  assert.ok(ideas.some(idea=>`${idea.title} ${idea.hook}`.includes("apartment beginners")));
});
