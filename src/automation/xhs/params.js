function normalizeOptions(input){
  const plat = input.platformCode || 'xhs';
  const keywords = Array.isArray(input.keywords) ? input.keywords : String(input.keywords||'').split(',').map(s=>s.trim()).filter(Boolean);
  const actions = input.actions || {};
  const limits = input.limits || {};
  const type = input.type || 'image_text';
  const delayRange = String(limits.delayRange||'500-1000');
  const parts = delayRange.split('-').map(v=>parseInt(v,10));
  return {
    platformCode: plat,
    keywords,
    actions: { like: !!actions.like, fav: !!actions.fav, comment: !!actions.comment, record: !!actions.record, browse: !!actions.browse },
    limits: { count: parseInt(limits.count||5,10)||5, perMin: parseInt(limits.perMin||6,10)||6, perHour: parseInt(limits.perHour||60,10)||60, dmin: parts[0]||500, dmax: parts[1]||1000 },
    type,
    captureEnabled: !!input.captureEnabled,
  };
}

module.exports = { normalizeOptions };

