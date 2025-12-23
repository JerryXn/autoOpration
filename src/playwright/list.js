/**
 * 列表采集（支持首屏与滚动）
 */
const { waitRand } = require('./session');
const { getListCards } = require('./locators');

/**
 * 采集搜索结果列表
 * @param {import('playwright').Page} page
 * @param {{limit?:number, scroll?:boolean}} opts
 * @returns {Promise<Array<{href:string,noteId:string,title:string,author:string,cover:string,snippet:string}>>}
 */
async function collectSearchList(page, opts={}){
  const limit = Math.max(1, parseInt((opts && opts.limit) || 50, 10) || 50);
  const doScroll = !(opts && opts.scroll===false);
  const uniq = new Map();
  const maxIters = doScroll ? 40 : 1;

  await page.waitForLoadState('domcontentloaded');
  if (!doScroll){ try{ await page.evaluate(()=>{ try{ window.scrollBy(0, 300); }catch{} }); }catch{} await waitRand(page); try{ await page.evaluate(()=>{ try{ window.scrollTo(0, 0); }catch{} }); }catch{} }

  // 先确保有候选容器渲染
  try{ await getListCards(page).first().waitFor({ state: 'visible', timeout: 8000 }); }catch{}

  for (let i=0;i<maxIters;i++){
    const items = await page.evaluate(()=>{
      function vis(el){ if(!el) return false; const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return false; const r=el.getBoundingClientRect(); return r.width>40&&r.height>40; }
      function pickTitle(el){ const cand=[ '[aria-label]', '[data-title]' ]; for(const s of cand){ const q=el.querySelector(s); if(q){ const t=q.getAttribute('aria-label')||q.getAttribute('data-title'); if(t) return String(t).trim(); } } const tt = String(el.textContent||'').trim(); if(tt) return tt; const img = el.querySelector('img'); const alt = img ? (img.getAttribute('alt')||'') : ''; return String(alt||'').trim(); }
      function pickAuthor(el){ const cand=[ '.author', '[class*="author"]', '.username', '[class*="nickname"]' ]; for(const s of cand){ const m = el.querySelector(s) || document.querySelector(s); if(m){ const t=String(m.textContent||'').trim(); if(t && !/^关(注|\s*注)?$/.test(t) && t!=='我') return t; } } return ''; }
      function pickCover(el){ const img = el.querySelector('img, img.live-img, img[data-src], img[data-original]'); if(!img) return ''; let src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || ''; if(!src){ const ss = img.srcset||''; if(ss){ const parts = ss.split(',').map(s=>s.trim()); const last = parts[parts.length-1]||''; src = String(last.split(' ')[0]||'').trim(); } } if(!src){ const st = String(el.getAttribute('style')||''); const m = st.match(/url\(([^)]+)\)/i); if(m){ src = m[1].replace(/['"]/g,''); } } return src||''; }
      const anchors = Array.from(document.querySelectorAll('a')).filter(a=>/\/explore\/[\w-]+/.test(String(a.href||''))||/\/discovery\/item\/[\w-]+/.test(String(a.href||'')));
      const out = [];
      for(const a of anchors){ if(!vis(a)) continue; const href = a.href || ''; if(!href) continue; const id = (href.match(/\/explore\/([\w-]+)/)||href.match(/\/discovery\/item\/([\w-]+)/)||[])[1]||''; const card = a.closest('article')||a.closest('.note-item')||a.closest('[data-note-id]')||a;
        const title = pickTitle(card||a);
        const author = pickAuthor(card||a);
        const cover = pickCover(card||a);
        const snippet = String((card||a).textContent||'').trim();
        out.push({ href, noteId: id, title, author, cover, snippet });
      }
      // Fallback：无锚点时，使用 data-note-id 构造 href
      const origin = location.origin;
      const cards = Array.from(document.querySelectorAll('[data-note-id], .note-item, article[role="article"]'));
      for(const c of cards){ if(!vis(c)) continue; const id = (c.getAttribute('data-note-id')||'').trim(); if(!id) continue; const href = origin + '/explore/' + id; if (out.find(x=>x.href===href)) continue; const title = pickTitle(c); const author = pickAuthor(c); const cover = pickCover(c); const snippet = String(c.textContent||'').trim(); out.push({ href, noteId: id, title, author, cover, snippet }); }
      return out;
    });
    for(const it of items){ if(!uniq.has(it.href)) uniq.set(it.href, it); }
    if(uniq.size>=limit) break;
    if (doScroll){ try{ await page.evaluate((n)=>window.scrollBy(0, n), 800); }catch{} await waitRand(page); }
  }
  return Array.from(uniq.values()).slice(0, limit);
}

module.exports = { collectSearchList };

