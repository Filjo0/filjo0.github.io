const labels=['Portfolio browser suites · Chromium','Marker assertions · Chromium','Marker assertions · WebKit',
 'Scene enhancement assertions · Chromium','Scene enhancement assertions · WebKit','Logic tests'];
const objects=['work','contact','resume','experience','books','fibonacci','globe','aqua','futsl'];
const positive=value=>Number.isSafeInteger(value)&&value>0;
// Public evidence is accepted as a complete record for this exact source only.
export function qualityStats(record,expectedDigest){
 if(!record||record.schema!==1||record.scope!=='This source · local browser validation'||
  !Number.isFinite(Date.parse(record.recordedAt))||!/^[a-f0-9]{64}$/.test(expectedDigest)||record.sourceDigest!==expectedDigest)
  throw Error('Unavailable or stale quality record');
 if(!Array.isArray(record.checks)||record.checks.length!==labels.length)throw Error('Incomplete check record');
 const counts=new Map();
 for(const check of record.checks){
  if(!labels.includes(check.label)||counts.has(check.label)||!positive(check.passed))throw Error('Invalid check count');
  counts.set(check.label,check.passed);
 }
 const entries=Object.entries(record.objects||{});
 if(entries.length!==objects.length||entries.some(([id,item])=>!objects.includes(id)||!positive(item?.viewports)))
  throw Error('Incomplete viewport record');
 return {suites:counts.get(labels[0]),viewports:Math.max(...entries.map(([,item])=>item.viewports)),engines:2};
}
