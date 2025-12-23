/**
 * 详情页最小字段提取
 */
const { waitRand } = require('./session');
const { getDetailRoot } = require('./locators');

/**
 * 返回最小字段集
 * @param {import('playwright').Page} page
 */
async function extractRequired(page){
  try{ await getDetailRoot(page).first().waitFor({ state: 'visible', timeout: 8000 }); }catch{}
  const d = await page.evaluate(()=>{
    const url = location.href;
    const id = (url.match(/\/explore\/([\w-]+)/)||[])[1]||'';
    const containers = [
      document.querySelector('article'),
      document.querySelector('.note-content'),
      document.querySelector('[data-content]')
    ].filter(Boolean);
    const root = containers[0] || document.body;
    function pickText(){ const el = document.getElementById('detail-desc') || root; return String(el.textContent||'').trim(); }
    function pickTitle(){ const el = document.getElementById('detail-title'); if (el) return String(el.textContent||'').trim();
      const cand=[ 'h1', 'h2', '[data-title]', '.title' ]; for(const s of cand){ const el2=(root.querySelector && root.querySelector(s)) || document.querySelector(s); if(el2){ const t=String(el2.textContent||'').trim(); if(t) return t; } }
      const meta = document.querySelector('meta[property="og:title"]'); if (meta){ const mt=String(meta.content||'').trim(); if(mt) return mt; }
      const tx = String((document.getElementById('detail-desc')||root).textContent||'').trim(); if(tx){ const first = tx.split(/\n|\r/).map(s=>s.trim()).find(s=>s.length>0) || ''; return first; }
      return ''; }
    function pickAuthor(){ const u = document.querySelector('.username'); if (u){ const t=String(u.textContent||'').trim(); if(t) return t; }
      const cand=[ 'a[href*="/user/profile"]', 'header a[href*="/user/"]', '[class*="author"] a', '.author a', '[class*="nickname"]', '[data-author]' ];
      for(const s of cand){ const el=document.querySelector(s); if(el){ const t=String(el.textContent||'').trim(); if(t && !/^关(注|\s*注)?$/.test(t) && t!=='我') return t; } }
      const meta = document.querySelector('meta[name="author"], meta[property="og:author"]'); return meta?String(meta.content||''):''; }
    function pickPublishDate(){ const els = Array.from(document.querySelectorAll('*')); const m = els.map(e=>String(e.textContent||'').trim()).find(tx=>/\b\d{2}-\d{2}\b/.test(tx)); const mm = m ? (m.match(/\b\d{2}-\d{2}\b/)||[])[0] : ''; return mm||''; }
    function pickCommentsCount(){ const tEl = document.querySelector('.total'); if (tEl){ const tx = String(tEl.textContent||'').trim(); const m = tx.match(/共\s*(\d+)\s*条评论/); if(m) return parseInt(m[1],10)||0; }
      const els = Array.from(document.querySelectorAll('*')); for(const e of els){ const tx=String(e.textContent||'').trim(); const m=tx.match(/^共\s*(\d+)\s*条评论$/); if(m) return parseInt(m[1],10)||0; } return null; }
    function imgUrls(){ const out=[]; const scope = root.querySelectorAll ? root : document; const imgs = scope.querySelectorAll('img, picture img, img.live-img, img[data-src], img[data-original]'); imgs.forEach(img=>{ let src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || ''; if(!src){ const ss = img.srcset||''; if(ss){ const parts = ss.split(',').map(s=>s.trim()); const last = parts[parts.length-1]||''; src = String(last.split(' ')[0]||'').trim(); } } if(!src){ const st = String(img.getAttribute('style')||''); const m = st.match(/url\(([^)]+)\)/i); if(m){ src = m[1].replace(/['"]/g,''); } } if(src) out.push(src); }); const bgEls = scope.querySelectorAll('[style*="background-image"]'); bgEls.forEach(el=>{ const st = String(el.getAttribute('style')||''); const m = st.match(/url\(([^)]+)\)/i); if(m){ const u = m[1].replace(/['"]/g,''); if(u) out.push(u); } }); const uniq = Array.from(new Set(out)); return uniq; }
    return { id, url, title: pickTitle(), author: pickAuthor(), text: pickText(), images: imgUrls(), published_at: pickPublishDate(), comments_count: pickCommentsCount() };
  });
  await waitRand(page);
  return { author: d.author||'', title: d.title||'', text: d.text||'', images: Array.isArray(d.images)?d.images:[], published_at: d.published_at||'', comments_count: d.comments_count==null?null:d.comments_count, url: d.url||'' };
}

module.exports = { extractRequired };

