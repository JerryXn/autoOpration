#!/usr/bin/env node
const { normalizeOptions } = require('./params');
const { run } = require('./runner');

function parseArgs(argv){
  const args = {}; const rest = argv.slice(2);
  for(let i=0;i<rest.length;i++){
    const t = rest[i];
    const m = t.match(/^--([^=]+)=(.*)$/);
    if (m){ args[m[1]] = m[2]; continue; }
    if (t.startsWith('--')){ const k=t.slice(2); const v=rest[i+1]; if (!v || v.startsWith('--')){ args[k]=true; } else { args[k]=v; i++; } }
  }
  return args;
}

(async function(){
  const raw = parseArgs(process.argv);
  const opts = normalizeOptions({
    platformCode: raw.platform||'xhs',
    keywords: raw.keyword||raw.keywords||'',
    actions: { like: !!raw.like, fav: !!raw.fav, comment: !!raw.comment, record: !!raw.record, browse: !!raw.browse },
    limits: { count: raw.limit||raw.count, perMin: raw.perMin, perHour: raw.perHour, delayRange: raw.delayRange },
    type: raw.type||'image_text',
    captureEnabled: raw.captureEnabled!==undefined ? !!raw.captureEnabled : true,
  });
  const res = await run(opts);
  if (!res || !res.ok){ console.error('run failed'); process.exit(1); }
})();

