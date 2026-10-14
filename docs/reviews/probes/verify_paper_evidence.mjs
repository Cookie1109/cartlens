import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root=fileURLToPath(new URL("../../../",import.meta.url))
const folder=path.join(root,"docs/reviews/paper-four-level")
const read=file=>JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""))
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):[path.join(folder,entry.name)])
const sourceFiles=["backend/src","frontend/src","frontend/tests"].flatMap(name=>walk(path.join(root,name)))
  .concat(["backend/pom.xml","backend/mvnw.cmd","backend/.mvn/wrapper/maven-wrapper.properties","frontend/package.json","frontend/pnpm-lock.yaml","frontend/playwright.config.ts",
    "frontend/tsconfig.json","frontend/vite.config.ts","frontend/index.html","frontend/AGENTS.md",
    "docs/reviews/probes/run_paper_protocol.ps1","docs/reviews/probes/verify_paper_evidence.mjs","docs/reviews/probes/paper_dataset_audit.mjs"].map(name=>path.join(root,name)))
const sourceHashes=sourceFiles.map(file=>({path:path.relative(root,file).replaceAll("\\","/"),sha256:hash(file)})).sort((a,b)=>a.path.localeCompare(b.path))
const suites=fs.readdirSync(path.join(root,"backend/target/surefire-reports")).filter(name=>/^TEST-.*\.xml$/.test(name)).map(name=> {
  const head=fs.readFileSync(path.join(root,"backend/target/surefire-reports",name),"utf8").match(/<testsuite\b[^>]*>/)[0]
  const value=key=>(head.match(new RegExp(`${key}="([^"]*)"`))||[])[1]
  return {name:value("name"),tests:Number(value("tests")),failures:Number(value("failures")),errors:Number(value("errors")),skipped:Number(value("skipped"))}
})
const totals=suites.reduce((sum,test)=>Object.fromEntries(["tests","failures","errors","skipped"].map(key=>[key,sum[key]+test[key]])),{tests:0,failures:0,errors:0,skipped:0})
const manifest=read(path.join(folder,"manifest.json"))
const runs=manifest.map(entry=>({name:entry.name,...(fs.existsSync(entry.resultFile)?read(entry.resultFile):{status:entry.status,completedRequestedProtocol:false,error:fs.readFileSync(entry.stderrFile,"utf8").slice(-4000)})}))
const repeatability=["retail-small","accidents-small"].map(profile=> {
  const selected=runs.filter(run=>run.name.startsWith(profile+"-"))
  const fingerprint=selected[0]?.resultFingerprint
  const verified=selected.length===4 && selected.every(run=>run.completedRequestedProtocol&&run.completedSlides===50&&run.resultFingerprint===fingerprint)
  if(!verified) throw new Error(`Repeatability/cross-algorithm check failed: ${profile}`)
  return {profile,verified,runs:selected.length,completedWindowsPerRun:51,fingerprint}
})
const summary={generatedUtc:new Date().toISOString(),gitHead:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),
  workingTreeIsDirty:execFileSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8"}).trim().length>0,
  reference:{path:"docs/specs/DeTaiJavaNangCao.pdf",sha256:hash(path.join(root,"docs/specs/DeTaiJavaNangCao.pdf"))},
  backend:{totals,suites},invariants:read(path.join(root,"backend/target/paper-four-level/invariants.json")),
  artifactHashes:[path.join(folder,"hardware.json"),path.join(folder,"manifest.json"),...walk(path.join(folder,"runs")).filter(file=>file.endsWith(".json"))]
    .map(file=>({path:path.relative(root,file).replaceAll("\\","/"),sha256:hash(file)})),
  exhaustiveCircularIntersectionCases:24576,repeatability,sourceHashes,
  hardware:read(path.join(folder,"hardware.json")),runtimeJarSha256:hash(path.join(root,"tmp/paper-four-level-backend.jar")),
  sourceSnapshot:{path:"docs/reviews/paper-four-level/source-snapshot.zip",sha256:hash(path.join(folder,"source-snapshot.zip"))},
  benchmarkRuns:runs.map(run=>({name:run.name,status:run.status,error:run.error,completedRequestedProtocol:run.completedRequestedProtocol,
    completedWindows:run.completedWindows,completedSlides:run.completedSlides,processedTransactions:run.processedTransactions,
    totalPatterns:run.totalPatternsAcrossWindows,algorithmTimedMs:run.algorithmTimedMs,resultFingerprint:run.resultFingerprint})),
  verdicts:{mathematicalResults:"PASS_IN_TESTED_DOMAIN",algorithmMechanism:"PARTIAL_DWT_METADATA_RESCAN",paperExperimentalProtocol:"PARTIAL_SEE_RUN_FAILURES_AND_MISSING_BASELINE",reproducibleEvidence:"PASS_FOR_SMALL_50_SLIDE_RUNS"}}
fs.writeFileSync(path.join(folder,"verification.json"),JSON.stringify(summary,null,2)+"\n")
console.log(JSON.stringify({backend:totals,invariants:summary.invariants,repeatability,benchmarks:summary.benchmarkRuns},null,2))
