;(function(){
  function normalizeName(s){
    if(!s) return '';
    s = String(s).trim();
    try{
      const u = new URL(s);
      const parts = u.pathname.split('/');
      return (parts[parts.length-1]||'').toLowerCase();
    }catch{
      return s.toLowerCase();
    }
  }
  function parseImageList(text){
    if(!text) return [];
    return String(text).split(',').map(v=>v.trim()).filter(Boolean).map(normalizeName);
  }
  function buildImageSet(files){
    const set = new Set();
    (files||[]).forEach(f=>{ if(f && f.name) set.add(f.name.toLowerCase()); });
    return set;
  }
  function toLogicalName(input){
    if (!input) return '';
    if (typeof input === 'string') return normalizeName(input);
    if (input && input.name) return normalizeName(input.name);
    return '';
  }
  function replaceRowImageName(rows, oldName, newName){
    const on = normalizeName(oldName);
    const nn = normalizeName(newName);
    rows.forEach(r => {
      ['cover','封面'].forEach(k => {
        if (r[k]) {
          const list = parseImageList(r[k]);
          const replaced = list.map(n => n === on ? nn : n);
          r[k] = replaced.join(',');
        }
      });
      ['images','配图'].forEach(k => {
        if (r[k]) {
          const list = parseImageList(r[k]);
          const replaced = list.map(n => n === on ? nn : n);
          r[k] = replaced.join(',');
        }
      });
    });
  }
  window.Utils = window.Utils || {};
  window.Utils.images = { normalizeName, parseImageList, buildImageSet, toLogicalName, replaceRowImageName };
})();