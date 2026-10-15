import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const directory = path.resolve(process.argv[2] || '');
assert(process.argv[2], 'Pass a completed run directory containing manifest.json');
const read = file => JSON.parse(fs.readFileSync(file,'utf8').replaceAll(String.fromCharCode(0xfeff),''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = read(path.join(directory,'manifest.json'));
const profiles = new Map();
const results = [];
for (const entry of manifest) {
    assert.equal(entry.status,'COMPLETED',entry.name);
    assert.equal(entry.exitCode,0,entry.name);
    const run = read(entry.resultFile);
    assert.equal(run.completedRequestedProtocol,true,entry.name);
    assert.equal(run.completedWindows,51,entry.name);
    assert.equal(run.completedSlides,50,entry.name);
    const heapArgument = entry.arguments.find(value=>value.startsWith('-Xmx'));
    assert(heapArgument && /^-Xmx[0-9]+m$/.test(heapArgument),'Expected a heap limit in MiB');
    assert.equal(run.maxHeapBytes,Number(heapArgument.slice(4,-1))*1024*1024,entry.name);
    assert.equal(run.sourceSha256,sha(path.join(run.source,'transactions.txt')));
    assert.equal(run.metadataSha256,sha(path.join(run.source,'investment_table.txt')));
    const key = [entry.dataset,run.config.windowPaneCount,run.config.minWus,run.fingerprintEncoding].join('|');
    const group = profiles.get(key) || [];
    group.push(run); profiles.set(key,group);
    results.push({name:entry.name,algorithm:run.algorithm,config:run.config,windows:run.completedWindows,
        transactions:run.processedTransactions,patterns:run.totalPatternsAcrossWindows,pipelineMs:run.totalPipelineMs,
        algorithmMs:run.algorithmTimedMs,sampledHeapMiB:run.sampledHeapUsedBytesAfterPanes/1048576,
        fingerprint:run.resultFingerprint,encoding:run.fingerprintEncoding,resultSha256:sha(entry.resultFile),
        jarSha256:entry.jarSha256});
}
assert([4,8,12].includes(results.length),'Expected four large runs, eight small repeats, or both');
for (const [profile,runs] of profiles) {
    assert.equal(new Set(runs.map(run=>run.algorithm)).size,2,profile);
    assert.equal(runs.length,profile.includes('|legacy')?4:2,profile);
    assert.equal(new Set(runs.map(r=>r.resultFingerprint)).size,1,profile);
    assert.equal(new Set(runs.map(r=>JSON.stringify(r.windows.map(w=>w.patternCount)))).size,1,profile);
    if (profile.includes('|legacy')) {
        const expected=profile.startsWith('Retail|')?'b62c73cb170c97d050d8fb0052df9e9e58eee34ccf1fc44bc737262492ff24f9':'c2bd6383e5f09d5bd57eb381f92d088806d5c0613ae8b310477c174dd13a455f';
        assert.equal(runs[0].resultFingerprint,expected,profile);
    }
}
assert.equal(new Set(results.map(r=>r.jarSha256)).size,1,'All runs must use the same JAR');
const report={checkedUtc:new Date().toISOString(),allPassed:true,runDirectory:directory,
    profileCount:profiles.size,runCount:results.length,results};
fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify(report,null,2)+String.fromCharCode(10));
console.log(JSON.stringify(report,null,2));
