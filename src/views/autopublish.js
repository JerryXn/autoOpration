;(function(){
  function mount(ctx){
    const { el, services, state: appState } = ctx;
    const excelPane = document.getElementById('excel-pane');
    const feishuPane = document.getElementById('feishu-pane');
    const globalLoading = document.getElementById('global-loading');
    const globalToast = document.getElementById('global-toast');
    const tabs = document.getElementById('autopub-tabs');
    const importPane = document.getElementById('import-pane');
    const publishPane = document.getElementById('publish-pane');
    const taskPane = document.getElementById('task-pane');
    const autoopPane = document.getElementById('autoop-pane');
    const publishTbody = document.getElementById('publish-tbody');
    const publishPager = document.getElementById('publish-pager');
    const publishFilter = document.getElementById('publish-filter');
    const errorPanel = document.getElementById('publish-error-panel');
    const errorBody = document.getElementById('publish-error-body');
    const openDevtoolsBtn = document.getElementById('open-devtools');
    const closeErrorPanelBtn = document.getElementById('close-error-panel');
    const downloadTplBtn = document.getElementById('download-template');
    const excelFileInput = document.getElementById('excel-file');
    const imageFilesInput = document.getElementById('image-files');
    const feishuLinkInput = document.getElementById('feishu-link');
    const feishuMsg = document.getElementById('feishu-msg');
    const feishuWebview = document.getElementById('feishu-webview');
    const feishuExcelFileInput = document.getElementById('feishu-excel-file');
    const feishuFolderInput = document.getElementById('feishu-folder');
    const confirmBtn = document.getElementById('confirm-upload');
    const exportBtn = document.getElementById('export-xlsx');
    const previewBody = document.getElementById('preview-body');
    const summary = document.getElementById('summary');
    const card = document.getElementById('autopub-card');
    const state = appState;
    if (globalLoading) globalLoading.style.display = 'none';
    function showToast(text){ if(!globalToast) return; globalToast.textContent = text || ''; globalToast.style.display = 'block'; setTimeout(()=>{ globalToast.style.display = 'none'; }, 3000); }
    function showCellTip(text, anchor){ if(!text) return; const r = anchor.getBoundingClientRect(); const tip = document.createElement('div'); tip.style.position='fixed'; tip.style.left=(r.left+8)+'px'; tip.style.top=(r.bottom+4)+'px'; tip.style.zIndex='9999'; tip.style.background='#fff'; tip.style.border='1px solid #eee'; tip.style.borderRadius='8px'; tip.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'; tip.style.padding='10px'; tip.style.maxWidth='480px'; tip.style.maxHeight='240px'; tip.style.overflow='auto'; tip.style.color='#333'; tip.textContent = text; document.body.appendChild(tip); state._cellTip = tip; }
    function hideCellTip(){ if (state._cellTip){ state._cellTip.remove(); state._cellTip = null; } }
    state.mode = 'excel';
    state.rows = [];
    state.imagesMap = new Map();
    state.missingByRow = [];
    state.viewer = null;
    state.viewerImg = null;
    const maxSize = 20 * 1024 * 1024;

    function rebuild(){
      previewBody.innerHTML = '';
      state.missingByRow = [];
      let missingCount = 0;
      function showTip(text, anchor){
        if (!text) return;
        if (state.previewTip) { state.previewTip.remove(); state.previewTip = null; }
        const r = anchor.getBoundingClientRect();
        const tip = document.createElement('div');
        tip.style.position = 'fixed';
        tip.style.left = (r.left + 8) + 'px';
        tip.style.top = (r.bottom + 4) + 'px';
        tip.style.zIndex = '9999';
        tip.style.background = '#fff';
        tip.style.border = '1px solid #eee';
        tip.style.borderRadius = '8px';
        tip.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
        tip.style.padding = '10px';
        tip.style.maxWidth = '480px';
        tip.style.maxHeight = '240px';
        tip.style.overflow = 'auto';
        tip.style.color = '#333';
        tip.textContent = text;
        document.body.appendChild(tip);
        state.previewTip = tip;
      }
      function hideTip(){ if (state.previewTip) { state.previewTip.remove(); state.previewTip = null; } }
      function limitedCell(full){
        const show = full && full.length>36 ? (full.slice(0,36) + '...') : full;
        const el = document.createElement('td');
        el.style.padding = '8px';
        el.style.borderBottom = '1px solid #f0f0f0';
        el.style.maxWidth = '240px';
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
        el.textContent = show;
        el.title = full || '';
        el.addEventListener('mouseenter', ()=>{ showTip(full||'', el); });
        el.addEventListener('mouseleave', ()=>{ hideTip(); });
        return el;
      }
      function limitedCellDanger(full, danger){
        const el = limitedCell(full);
        if (danger) el.style.color = '#c00';
        return el;
      }
      state.rows.forEach((r, idx) => {
        const covers = window.Utils.images.parseImageList(r.cover || r.封面 || '');
        const images = window.Utils.images.parseImageList(r.images || r.配图 || '');
        const keys = new Set(Array.from(state.imagesMap.keys()));
        const keysArr = Array.from(keys);
        function canonicalPrefix(n){
          let base = String(n||'').toLowerCase().trim();
          if (!base) return null;
          const dot = base.lastIndexOf('.');
          if (dot > 0) base = base.slice(0, dot);
          const m = base.match(/^([^-]+)-(\d{4})-(\d{2})-(\d{2})-(\d+)-/);
          if (!m) return null;
          return `${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}-`;
        }
        function exists(n, type){
          const root = state.rootFolderName || null;
          if (keys.has(n) || keys.has(type + '/' + n) || (root && keys.has(root + '/' + type + '/' + n))) return true;
          const pref = canonicalPrefix(n);
          if (pref){
            for (const k of keysArr){
              if (k.startsWith(pref) || k.startsWith(type + '/' + pref) || k.includes('/' + type + '/' + pref)) return true;
            }
          }
          return false;
        }
        const missCover = covers.filter(n => !exists(n, '封面'));
        const missImages = images.filter(n => !exists(n, '配图'));
        missingCount += missCover.length + missImages.length;
        state.missingByRow[idx] = { missCover, missImages };
        const tr = document.createElement('tr');
        tr.appendChild(limitedCell(r.title || r.标题 || ''));
        tr.appendChild(limitedCell(r.content || r.文案 || ''));
        tr.appendChild(limitedCell((covers||[]).join(', ')));
        tr.appendChild(limitedCell((images||[]).join(', ')));
        tr.appendChild(limitedCellDanger(missCover.length ? `缺失: ${missCover.join(', ')}` : '全部匹配', missCover.length>0));
        tr.appendChild(limitedCellDanger(missImages.length ? `缺失: ${missImages.join(', ')}` : '全部匹配', missImages.length>0));
        previewBody.appendChild(tr);
      });
      summary.textContent = `共 ${state.rows.length} 条，缺失图片项 ${missingCount} 个`;
    }

    function ensureViewer(){
      if (state.viewer) return;
      const overlay = document.createElement('div');
      overlay.className = 'image-viewer';
      const img = document.createElement('img');
      overlay.appendChild(img);
      overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
      document.body.appendChild(overlay);
      state.viewer = overlay; state.viewerImg = img;
    }

    function renderThumbs(){
      const grid = document.getElementById('image-preview-grid');
      if (!grid) return;
      grid.innerHTML = '';
      state.imagesMap.forEach((info, logicalName) => {
        const div = document.createElement('div');
        div.className = 'thumb-item';
        const wrap = document.createElement('div');
        wrap.className = 'thumb-img-wrap';
        const img = document.createElement('img');
        img.className = 'thumb-img';
        img.src = info.url;
        wrap.appendChild(img);
        const actions = document.createElement('div');
        actions.className = 'thumb-actions';
        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn-small';
        replaceBtn.textContent = '更换';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-small';
        delBtn.textContent = '删除';
        actions.appendChild(replaceBtn);
        actions.appendChild(delBtn);
        div.appendChild(wrap);
        div.appendChild(actions);
        grid.appendChild(div);
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        div.appendChild(fileInput);
        replaceBtn.addEventListener('click', () => fileInput.click());
        img.addEventListener('click', () => {
          ensureViewer();
          state.viewerImg.src = info.url;
          state.viewer.style.display = 'flex';
        });
        fileInput.addEventListener('change', () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (f.size > maxSize) { alert('图片大小不能超过20MB'); fileInput.value=''; return; }
          const old = state.imagesMap.get(logicalName);
          if (old && old.url) URL.revokeObjectURL(old.url);
          const url = URL.createObjectURL(f);
          state.imagesMap.set(logicalName, { file: f, physicalName: f.name, url });
          img.src = url;
          rebuild();
        });
        delBtn.addEventListener('click', () => {
          const old = state.imagesMap.get(logicalName);
          if (old && old.url) URL.revokeObjectURL(old.url);
          state.imagesMap.delete(logicalName);
          renderThumbs();
          rebuild();
        });
      });
    }

    document.querySelectorAll('input[name="source-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        state.mode = r.value;
        if (state.mode === 'excel') {
          excelPane.style.display='block';
          feishuPane.style.display='none';
          if (downloadTplBtn) downloadTplBtn.disabled = false;
        } else {
          excelPane.style.display='none';
          feishuPane.style.display='block';
          if (downloadTplBtn) downloadTplBtn.disabled = true;
        }
      });
    });

    function setActiveTab(name){
      if (!tabs) return;
      tabs.querySelectorAll('.tab').forEach(b => {
        if (b.dataset.tab === name) b.classList.add('active'); else b.classList.remove('active');
      });
      if (name === 'import') { importPane.style.display='block'; publishPane.style.display='none'; taskPane.style.display='none'; }
      else if (name === 'publish') { importPane.style.display='none'; publishPane.style.display='block'; taskPane.style.display='none'; if (publishTbody) publishTbody.innerHTML=''; if (publishPager) publishPager.innerHTML=''; if (publishFilter) publishFilter.value = 'unpublished'; loadPublishList(); }
      else { importPane.style.display='none'; publishPane.style.display='none'; taskPane.style.display='block'; loadSlots(); }
    }

    async function loadPublishList(page=1){
      if (!publishTbody || !publishPager) return;
      const reqId = (state.listReqId||0) + 1; state.listReqId = reqId;
      publishTbody.innerHTML = '';
      publishPager.innerHTML = '';
      const status = publishFilter ? publishFilter.value : 'unpublished';
      const res = await services.ipc.listParsedContents(state.selectedPlatform, page, 10, status);
      if (reqId !== state.listReqId) return;
      if (!res || !res.ok) { const d=document.createElement('div'); d.className='muted'; d.textContent = (res&&res.error)?res.error:'加载失败'; publishPager.appendChild(d); return; }
      const items = res.items || [];
      items.forEach(it => {
        const tr = document.createElement('tr');
        function td(){ const el=document.createElement('td'); el.style.padding='8px'; el.style.borderBottom='1px solid #f0f0f0'; return el; }
        const c1 = td(); const cover=document.createElement('img'); cover.src=it.coverThumbUrl||''; cover.style.width='60px'; cover.style.height='80px'; cover.style.objectFit='cover'; cover.style.borderRadius='6px'; c1.appendChild(cover); tr.appendChild(c1);
        const c2 = td(); const fullTitle = it.title || ''; const showTitle = fullTitle && fullTitle.length>36 ? (fullTitle.slice(0,36)+'...') : fullTitle; c2.textContent = showTitle; c2.title = fullTitle; c2.addEventListener('mouseenter', ()=> showCellTip(fullTitle, c2)); c2.addEventListener('mouseleave', hideCellTip); tr.appendChild(c2);
        const c3 = td(); const full = it.content || ''; const show = full && full.length>36 ? (full.slice(0,36) + '...') : full; c3.textContent = show; c3.title = full; tr.appendChild(c3);
        const c4 = td(); c4.textContent = it.platform_code || ''; tr.appendChild(c4);
        const c5 = td(); c5.textContent = (it.status==='published') ? '已发布' : '未发布'; tr.appendChild(c5);
        const c6 = td(); c6.textContent = it.published_at ? new Date(it.published_at).toLocaleString() : ''; tr.appendChild(c6);
        const c7 = td(); const imgsWrap=document.createElement('div'); imgsWrap.style.display='flex'; imgsWrap.style.flexWrap='wrap'; imgsWrap.style.gap='6px'; (it.imageThumbUrls||[]).forEach(u=>{ const im=document.createElement('img'); im.src=u; im.style.width='40px'; im.style.height='40px'; im.style.objectFit='cover'; im.style.borderRadius='4px'; imgsWrap.appendChild(im); }); c7.appendChild(imgsWrap); tr.appendChild(c7);
        const c8 = td(); c8.textContent = new Date(it.created_at).toLocaleString(); tr.appendChild(c8);
        const c9 = td();
        if (it.status !== 'published'){
          const btn = document.createElement('button');
          btn.className = 'btn-small';
          btn.textContent = '立即发布';
          btn.addEventListener('click', async ()=>{
            btn.disabled = true; const old = btn.textContent; btn.textContent = '发布中…';
            try{
              const res = await services.ipc.startWebPublish(it.id);
              if (res && res.ok){ showToast('发布成功'); loadPublishList(1); }
              else {
                const msg = (res&&res.error)?res.error:'发布失败';
                const logs = (res&&res.logs)||[];
                const shot = (res&&res.screenshot)||null;
                try{
                  console.error('publish-error', msg);
                  logs.forEach(l=>console.error(l));
                  if (shot) console.error('publish-error-screenshot', shot);
                }catch{}
                if (errorPanel && errorBody){
                  const pre = document.createElement('pre');
                  pre.textContent = [msg].concat(logs).join('\n');
                  errorBody.innerHTML = '';
                  errorBody.appendChild(pre);
                  if (shot){
                    const a = document.createElement('a');
                    a.href = shot; a.textContent = '查看失败截图'; a.target = '_blank'; a.style.display='inline-block'; a.style.marginTop='6px';
                    errorBody.appendChild(a);
                  }
                  errorPanel.style.display = 'block';
                }
                alert(msg);
              }
            } finally {
              btn.textContent = old; btn.disabled = false;
            }
          });
          c9.appendChild(btn);
        }
        tr.appendChild(c9);
        publishTbody.appendChild(tr);
      });
      const info = document.createElement('div'); info.className='info'; info.textContent = `共 ${res.total} 条，当前第 ${res.page}/${Math.max(1, Math.ceil(res.total/res.pageSize))} 页`;
      const prev = document.createElement('button'); prev.textContent='上一页'; prev.disabled = res.page<=1; prev.addEventListener('click', ()=>loadPublishList(res.page-1));
      const next = document.createElement('button'); next.textContent='下一页'; next.disabled = res.page>=Math.ceil(res.total/res.pageSize); next.addEventListener('click', ()=>loadPublishList(res.page+1));
      publishPager.appendChild(info); publishPager.appendChild(prev); publishPager.appendChild(next);
    }

    if (publishFilter) publishFilter.addEventListener('change', ()=> loadPublishList(1));

    const autoType = document.getElementById('autoop-type');
    const autoKeywords = document.getElementById('autoop-keywords');
    const autoBrowse = document.getElementById('autoop-browse');
    const autoLike = document.getElementById('autoop-like');
    const autoFav = document.getElementById('autoop-fav');
    const autoComment = document.getElementById('autoop-comment');
    const autoRecord = document.getElementById('autoop-record');
    const autoCount = document.getElementById('autoop-limit-count');
    const autoPerMin = document.getElementById('autoop-limit-permin');
    const autoPerHour = document.getElementById('autoop-limit-perhour');
    const autoDelayRange = document.getElementById('autoop-delay-range');
    const autoMcp = document.getElementById('autoop-mcp-url');
    const autoStart = document.getElementById('autoop-start');
    const autoStop = document.getElementById('autoop-stop');
    const autoStatus = document.getElementById('autoop-status');
    const autoLog = document.getElementById('autoop-log');

    let currentRunId = null;
    if (autoStart) autoStart.addEventListener('click', async () => {
      const payload = {
        platformCode: state.selectedPlatform,
        type: autoType ? autoType.value : 'image_text',
        keywords: autoKeywords ? autoKeywords.value : '',
        actions: { browse: !!(autoBrowse && autoBrowse.checked), like: !!(autoLike && autoLike.checked), fav: !!(autoFav && autoFav.checked), comment: !!(autoComment && autoComment.checked), record: !!(autoRecord && autoRecord.checked) },
        limits: { count: parseInt(autoCount.value||'10',10)||10, perMin: parseInt(autoPerMin.value||'6',10)||6, perHour: parseInt(autoPerHour.value||'60',10)||60, delayRange: autoDelayRange.value||'300-1200' },
        mcpUrl: autoMcp ? autoMcp.value.trim() : null
      };
      autoStart.disabled = true;
      autoStatus.textContent = '运行中…';
      const res = await services.ipc.startAutoOp(payload);
      if (res && res.ok) { currentRunId = res.runId; showToast('已启动自动运营'); autoLog.style.display='none'; console.log('[autoop] 输入关键字: ' + (autoKeywords ? autoKeywords.value : '')); console.log('[autoop] 点击搜索按钮'); var __startUrl = ''; if (state.selectedPlatform==='xhs') { __startUrl = 'https://www.xiaohongshu.com/explore'; } console.log('[autoop] 浏览当前页面地址为: ' + __startUrl); }
      else { alert((res&&res.error)?res.error:'启动失败'); }
      autoStart.disabled = false;
    });
    if (autoStop) autoStop.addEventListener('click', async () => {
      autoStop.disabled = true;
      const res = await services.ipc.stopAutoOp(currentRunId);
      if (res && res.ok) { showToast('已停止'); autoStatus.textContent='已停止'; }
      else { alert((res&&res.error)?res.error:'停止失败'); }
      autoStop.disabled = false;
    });

    if (tabs && !state._autopubListenersBound) { tabs.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab))); state._autopubListenersBound = true; }
    setActiveTab('import');

    if (downloadTplBtn) downloadTplBtn.addEventListener('click', () => window.Utils.xlsx.genTemplate());
    if (excelFileInput) excelFileInput.addEventListener('change', async () => {
      const f = excelFileInput.files && excelFileInput.files[0];
      if (!f) return;
      try { state.rows = await window.Utils.xlsx.parseExcelFile(f); rebuild(); } catch(e){ alert('Excel 解析失败'); }
    });
    if (feishuExcelFileInput) feishuExcelFileInput.addEventListener('change', async () => {
      const f = feishuExcelFileInput.files && feishuExcelFileInput.files[0];
      if (!f) return;
      try { state.rows = await window.Utils.xlsx.parseExcelFile(f); rebuild(); } catch(e){ alert('Excel 解析失败'); }
    });
    if (imageFilesInput) imageFilesInput.addEventListener('change', () => {
      const files = Array.from(imageFilesInput.files||[]);
      const overs = [];
      files.forEach(f => {
        if (f.size > maxSize) { overs.push(f.name); return; }
        const logical = window.Utils.images.toLogicalName(f);
        const url = URL.createObjectURL(f);
        const prev = state.imagesMap.get(logical);
        if (prev && prev.url) URL.revokeObjectURL(prev.url);
        state.imagesMap.set(logical, { file: f, physicalName: f.name, url });
      });
      if (overs.length) alert('以下图片超过20MB，已忽略:\n' + overs.join('\n'));
      renderThumbs();
      rebuild();
    });
    if (feishuFolderInput) feishuFolderInput.addEventListener('change', () => {
      const files = Array.from(feishuFolderInput.files||[]);
      const overs = [];
      state.imagesMap.forEach(info => { if (info && info.url) URL.revokeObjectURL(info.url); });
      state.imagesMap.clear();
      state.rootFolderName = null;
      files.forEach(f => {
        if (!f || !f.name) return;
        if (f.size > maxSize) { overs.push(f.name); return; }
        const rel = f.webkitRelativePath || '';
        const segs = String(rel).split('/').filter(Boolean);
        let root = null, top = null, name = (f.name||'').toLowerCase();
        if (segs.length >= 3){ root = segs[0]; top = segs[1]; }
        else if (segs.length >= 2){ top = segs[0]; }
        if (!top || !['封面','配图','人物形象'].includes(top)) return;
        if (!state.rootFolderName && root) state.rootFolderName = root;
        const logical = `${top}/${name}`;
        const url = URL.createObjectURL(f);
        const prev = state.imagesMap.get(logical);
        if (prev && prev.url) URL.revokeObjectURL(prev.url);
        state.imagesMap.set(logical, { file: f, physicalName: f.name, url });
        if (state.rootFolderName){
          const withRoot = `${state.rootFolderName}/${top}/${name}`;
          const prev2 = state.imagesMap.get(withRoot);
          if (prev2 && prev2.url) URL.revokeObjectURL(prev2.url);
          state.imagesMap.set(withRoot, { file: f, physicalName: f.name, url });
        }
      });
      if (overs.length) alert('以下图片超过20MB，已忽略:\n' + overs.join('\n'));
      rebuild();
    });
    if (feishuLinkInput) feishuLinkInput.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        const url = feishuLinkInput.value.trim();
        if (!url) return;
        feishuMsg.textContent = '';
        if (feishuWebview) { feishuWebview.style.display='block'; feishuWebview.src = url; }
      }
    });

    if (feishuWebview) {
      feishuWebview.addEventListener('did-finish-load', async () => {
        try {
          const script = `(() => {
            const pickText = el => (el && (el.textContent||'').trim()) || '';
            const tables = Array.from(document.querySelectorAll('table'));
            const t = tables[0];
            if (!t) return { ok:false, reason:'no_table' };
            const ths = Array.from(t.querySelectorAll('thead th'));
            let header = ths.length ? ths.map(pickText) : [];
            const allRows = Array.from(t.querySelectorAll('tr'));
            if (!header.length && allRows.length) header = Array.from(allRows[0].querySelectorAll('th,td')).map(pickText);
            const bodyRows = Array.from(t.querySelectorAll('tbody tr'));
            const dataTrs = bodyRows.length ? bodyRows : (allRows.length>1 ? allRows.slice(1) : []);
            const rows = dataTrs.map(tr => Array.from(tr.querySelectorAll('td')).map(pickText));
            return { ok:true, header, rows };
          })()`;
          const parsed = await feishuWebview.executeJavaScript(script);
          if (!parsed || !parsed.ok) { feishuMsg.textContent = '页面未找到可解析的表格'; return; }
          const header = parsed.header || [];
          const idx = name => header.findIndex(h => (h||'').trim() === name);
          const ti = idx('标题');
          const ci = idx('文案');
          const coi = idx('封面');
          const ii = idx('配图');
          state.rows = (parsed.rows||[]).map(row=>({
            title: ti>=0 ? (row[ti]||'') : '',
            content: ci>=0 ? (row[ci]||'') : '',
            cover: coi>=0 ? (row[coi]||'') : '',
            images: ii>=0 ? (row[ii]||'') : ''
          }));
          rebuild();
        } catch (err) {
          try {
            const res = await services.ipc.fetchFeishu(feishuWebview.src||'');
            if (!res || !res.ok) { feishuMsg.textContent = (res && res.error) ? res.error : '链接解析失败'; return; }
            const header = res.header || [];
            const idx = name => header.findIndex(h => (h||'').trim() === name);
            const ti = idx('标题'), ci = idx('文案'), coi = idx('封面'), ii = idx('配图');
            state.rows = (res.rows||[]).map(row=>({
              title: ti>=0 ? (row[ti]||'') : '',
              content: ci>=0 ? (row[ci]||'') : '',
              cover: coi>=0 ? (row[coi]||'') : '',
              images: ii>=0 ? (row[ii]||'') : ''
            }));
            rebuild();
          } catch(e){ feishuMsg.textContent = '解析失败'; }
        }
      });
    }
    
    async function gatherMediaPayload(){
      const arr = [];
      for (const [logical, info] of state.imagesMap.entries()){
        const f = info.file;
        if (!f) continue;
        const b64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const res = String(r.result || '');
            const idx = res.indexOf(',');
            resolve(idx >= 0 ? res.slice(idx + 1) : '');
          };
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        arr.push({ logicalName: logical, physicalName: info.physicalName, mime: f.type || null, data: b64 });
      }
      return arr;
    }
    if (confirmBtn) confirmBtn.addEventListener('click', async () => {
      const loading = document.getElementById('global-loading');
      if (loading) loading.style.display = 'flex';
      let totalMissing = 0;
      state.missingByRow.forEach(m => { totalMissing += (m.missCover?m.missCover.length:0) + (m.missImages?m.missImages.length:0); });
      if (totalMissing>0){
        const detail = state.missingByRow.map((m,i)=>{
          const a=[]; if(m.missCover&&m.missCover.length) a.push(`第${i+1}行 封面缺失: ${m.missCover.join(', ')}`); if(m.missImages&&m.missImages.length) a.push(`第${i+1}行 配图缺失: ${m.missImages.join(', ')}`); return a.join('\n');
        }).filter(Boolean).join('\n');
        const ok = window.confirm('存在未匹配的图片，是否继续保存？\n\n'+detail);
        if (!ok) { if (loading) loading.style.display = 'none'; return; }
      }
      try {
        const media = await gatherMediaPayload();
        const services = window.Services;
        const res = await services.ipc.saveParsedContent({ platformCode: state.selectedPlatform, type: 'image_text', rows: state.rows, media });
        if (res && res.ok) {
          showToast(`已保存 ${res.savedCount}`);
        } else {
          alert((res && res.error) ? res.error : '保存失败');
        }
      } finally {
        if (loading) loading.style.display = 'none';
      }
    });
    el.style.display = 'block';
    document.getElementById('features').style.display = 'none';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('title').textContent = '自动发布';
    window.AppView = 'autopublish';
    if (tabs) {
      if (!state._autopubListenersBound) { tabs.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab))); state._autopubListenersBound = true; }
      setActiveTab('import');
    }
    async function loadSlots(){
      if (!slotsList) return;
      slotsList.innerHTML = '';
      const res = await services.ipc.getPublishSchedules(state.selectedPlatform);
      const slots = (res&&res.ok) ? (res.slots||[]) : [];
      const toMin = t=>{ const [h,m] = String(t).split(':').map(v=>parseInt(v,10)||0); return h*60+m; };
      slots.sort((a,b)=> toMin(a.time)-toMin(b.time));
      slots.forEach((s) => addSlotRow(s.time||'', s.count||1));
      sortSlotsDom();
    }

    function addSlotRow(time, count){
      const tr = document.createElement('tr');
      function td(){ const el=document.createElement('td'); el.style.padding='8px'; el.style.borderBottom='1px solid #f0f0f0'; return el; }
      const t1 = td(); const i1=document.createElement('input'); i1.type='time'; i1.value=time; t1.appendChild(i1); tr.appendChild(t1);
      const t2 = td(); const i2=document.createElement('input'); i2.type='number'; i2.min='1'; i2.value=String(count); t2.appendChild(i2); tr.appendChild(t2);
      const t3 = td(); const del=document.createElement('button'); del.className='btn-small'; del.textContent='删除'; del.addEventListener('click', ()=>{ slotsList.removeChild(tr); }); t3.appendChild(del); tr.appendChild(t3);
      slotsList.appendChild(tr);
      sortSlotsDom();
    }

    if (!state._slotListenersBound){
      if (addSlotBtn) addSlotBtn.addEventListener('click', ()=> addSlotRow('09:00',1));
      if (saveSlotsBtn) saveSlotsBtn.addEventListener('click', async ()=>{
        const rows = Array.from(slotsList.querySelectorAll('tr'));
        const slots = [];
        for (const r of rows){
          const inputs = r.querySelectorAll('input');
          const time = inputs[0].value||'09:00';
          const count = parseInt(inputs[1].value||'1',10)||1;
          if (count < 1) { alert('发布数量必须为正整数'); return; }
          slots.push({ time, count });
        }
        const toMin = (t)=>{ const [h,m] = String(t).split(':').map(v=>parseInt(v,10)||0); return h*60+m; };
        const mins = slots.map(s=>toMin(s.time)).sort((a,b)=>a-b);
        for (let i=1;i<mins.length;i++){ if (mins[i]===mins[i-1]) { alert('存在重复的发布时间，请调整后再保存'); return; } }
        const res = await services.ipc.savePublishSchedules(state.selectedPlatform, slots);
        if (res && res.ok) {
          showToast('保存成功');
        } else {
          alert((res&&res.error)?res.error:'保存失败');
        }
      });
      state._slotListenersBound = true;
    }
  }
  function unmount(ctx){
    const el = ctx.el; if (el) el.style.display = 'none';
    const publishTbody = document.getElementById('publish-tbody');
    const publishPager = document.getElementById('publish-pager');
    if (publishTbody) publishTbody.innerHTML = '';
    if (publishPager) publishPager.innerHTML = '';
    const s = ctx.state; if (s) { s.listReqId = 0; }
  }
  window.Views = window.Views || {};
  window.Views.autopublish = { mount, unmount };
})();
    const slotsList = document.getElementById('slots-list');
    const addSlotBtn = document.getElementById('add-slot');
    const saveSlotsBtn = document.getElementById('save-slots');
    function sortSlotsDom(){
      if (!slotsList) return;
      const rows = Array.from(slotsList.querySelectorAll('tr'));
      const toMin = t=>{ const [h,m] = String(t).split(':').map(v=>parseInt(v,10)||0); return h*60+m; };
      const arr = rows.map(r=>{ const inputs=r.querySelectorAll('input'); return { tr:r, s: toMin(inputs[0].value||'00:00') }; });
      arr.sort((a,b)=>a.s-b.s);
      arr.forEach(({tr})=> slotsList.appendChild(tr));
    }
    if (openDevtoolsBtn) openDevtoolsBtn.addEventListener('click', ()=>{ try{ window.Services.ipc.openDevTools(); }catch{} });
    if (closeErrorPanelBtn) closeErrorPanelBtn.addEventListener('click', ()=>{ if(errorPanel) errorPanel.style.display='none'; });
