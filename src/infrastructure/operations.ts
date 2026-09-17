import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "./database";
import { aggregateHealth, budgetHealth, type HealthLevel } from "@/domain/operations";
import { connectionStatus } from "./youtube-auth";

export type OperationalCheck={name:string;level:HealthLevel;detail:string};
export type OperationsReport={level:HealthLevel;checks:OperationalCheck[];counts:{projects:number;jobs:number;failedJobs:number};costs:{actualUsd:number;estimatedUsd:number;monthlyLimitUsd:number};databaseBytes:number;generatedAt:string};

export function operationsReport():OperationsReport {
  const integrity=(db.prepare("PRAGMA integrity_check").get() as {integrity_check:string}).integrity_check;
  const jobs=db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed, COALESCE(SUM(actual_cost_usd),0) actual, COALESCE(SUM(estimated_cost_usd),0) estimated FROM workflow_jobs").get() as {total:number;failed:number;actual:number;estimated:number};
  const projects=(db.prepare("SELECT COUNT(*) total FROM video_projects").get() as {total:number}).total;
  const youtube=connectionStatus(),monthlyLimitUsd=Number(process.env.MONTHLY_BUDGET_USD??50);
  const checks:OperationalCheck[]=[
    {name:"Database integrity",level:integrity==="ok"?"HEALTHY":"BLOCKED",detail:integrity},
    {name:"Workflow failures",level:jobs.failed>0?"WARNING":"HEALTHY",detail:jobs.failed?`${jobs.failed} failed jobs need review`:"No failed durable jobs"},
    {name:"Monthly budget",level:budgetHealth(jobs.actual,monthlyLimitUsd),detail:`$${jobs.actual.toFixed(2)} actual of $${monthlyLimitUsd.toFixed(2)} limit`},
    {name:"Publishing provider",level:process.env.PUBLISH_PROVIDER==="youtube"?(youtube.connected?"HEALTHY":"BLOCKED"):"HEALTHY",detail:process.env.PUBLISH_PROVIDER==="youtube"?(youtube.connected?"Live YouTube connected":"Live mode requires a YouTube connection"):"Fully functional local demo mode"},
    {name:"Analytics provider",level:process.env.ANALYTICS_PROVIDER==="youtube"&&!youtube.connected?"BLOCKED":"HEALTHY",detail:process.env.ANALYTICS_PROVIDER==="youtube"?"Live YouTube mode":"Deterministic demo mode"},
    {name:"YouTube live data",level:youtube.connected?"HEALTHY":youtube.configured?"WARNING":"HEALTHY",detail:youtube.connected?"Connected channel data and analytics are available":youtube.configured?"OAuth is configured; connect a channel from Channel setup":"Optional until Google OAuth credentials are configured"},
  ];
  const databasePath=resolve(process.env.DATABASE_PATH??"./data/control-center.sqlite");
  return{level:aggregateHealth(checks.map(c=>c.level)),checks,counts:{projects,jobs:jobs.total,failedJobs:jobs.failed},costs:{actualUsd:jobs.actual,estimatedUsd:jobs.estimated,monthlyLimitUsd},databaseBytes:statSync(databasePath).size,generatedAt:new Date().toISOString()};
}

export function createDatabaseBackup(){const directory=resolve("data","backups");mkdirSync(directory,{recursive:true});const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");const path=resolve(directory,`control-center-${stamp}.sqlite`);db.exec(`VACUUM INTO '${path.replaceAll("'","''")}'`);return path;}
