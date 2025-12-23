;(function(){
  async function mount(ctx){
    const { services, state } = ctx;
    const autoType = document.getElementById('autoop-type');
    const autoKeywords = document.getElementById('autoop-keywords');
    const autoBrowse = document.getElementById('autoop-browse');
    const autoLike = document.getElementById('autoop-like');
    const autoLikeProb = document.getElementById('autoop-like-prob');
    const autoFav = document.getElementById('autoop-fav');
    const autoFavProb = document.getElementById('autoop-fav-prob');
    const autoComment = document.getElementById('autoop-comment');
    const autoCommentProb = document.getElementById('autoop-comment-prob');
    const autoRecord = document.getElementById('autoop-record');
    const autoCount = document.getElementById('autoop-limit-count');
    // Removed: autoPerMin, autoPerHour
    const autoDelayRange = document.getElementById('autoop-delay-range');
    const autoBrowseTime = document.getElementById('autoop-browse-time');
    const autoStart = document.getElementById('autoop-start');
    const autoStop = document.getElementById('autoop-stop');
    const autoStatus = document.getElementById('autoop-status');
    const autoLog = document.getElementById('autoop-log');
    const autoLogToggle = document.getElementById('autoop-toggle-log');
    // Removed: rankBtn
    
    // New Data View Buttons
    const viewNotesBtn = document.getElementById('view-scraped-data');
    const viewCommentsBtn = document.getElementById('view-scraped-comments');
    
    // Modal Elements
    const modalOverlay = document.getElementById('data-modal');
    const modalClose = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalThead = document.getElementById('modal-thead');
    const modalTbody = document.getElementById('modal-tbody');
    const modalPrev = document.getElementById('modal-prev');
    const modalNext = document.getElementById('modal-next');
    const modalPageInfo = document.getElementById('modal-page-info');

    // Removed: rankWrap, rankThead, rankTbody
    const autoSort = document.getElementById('autoop-sort');
    const autoPublishTime = document.getElementById('autoop-publish-time');
    const autoScope = document.getElementById('autoop-scope');
    const autoDistance = document.getElementById('autoop-distance');
    const autoIndustry = document.getElementById('autoop-industry');
    const lv1Area = document.getElementById('lv1-area');
    const lv2Area = document.getElementById('lv2-area');
    const lv3Area = document.getElementById('lv3-area');

    function getUserGroup(){
      try{ if (state.user && state.user.group) return state.user.group }catch{}
      try{ const v = localStorage.getItem('userGroup'); if (v) return v }catch{}
      return 'admin'
    }

    function getPermissionsByGroup(g){
      const groups = {
        lv1: { canBrowse:true, canSearch:true, canLike:false, canFav:false, canComment:false },
        lv2: { canBrowse:true, canSearch:true, canLike:true, canFav:true, canComment:false },
        lv3: { canBrowse:true, canSearch:true, canLike:true, canFav:true, canComment:true },
        admin: { canBrowse:true, canSearch:true, canLike:true, canFav:true, canComment:true }
      }
      return groups[g] || groups.admin
    }

    function showToast(msg){
      const el = document.getElementById('global-toast');
      if (!el) return;
      el.textContent = String(msg||'');
      el.style.display = 'block';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(()=>{ try{ el.style.display='none'; }catch{} }, 1800);
    }
    const permTipEl = document.getElementById('perm-tooltip');
    function showPermTip(msg, x, y){ if (!permTipEl) return; permTipEl.textContent = String(msg||''); permTipEl.style.display = 'block'; permTipEl.style.left = (x)+'px'; permTipEl.style.top = (y)+'px'; }
    function movePermTip(x, y){ if (!permTipEl) return; if (permTipEl.style.display !== 'block') return; permTipEl.style.left = (x)+'px'; permTipEl.style.top = (y)+'px'; }
    function hidePermTip(){ if (!permTipEl) return; permTipEl.style.display = 'none'; }
    function applyPermissions(){
      const g = getUserGroup()
      const perms = getPermissionsByGroup(g)
      try{ document.getElementById('title').textContent = '自动运营（'+g+'）' }catch{}
      const nodes = document.querySelectorAll('[data-permission]')
      nodes.forEach(n=>{
        const key = n.getAttribute('data-permission')
        const allowed = !!perms[key]
        try{ n.disabled = !allowed }catch{}
        if (!allowed){
          n.classList.add('disabled');
          const label = n.closest('label');
          if (label){
            label.onmouseenter = (ev)=>{ showPermTip('白嫖结束，升级吧大佬', ev.clientX+12, ev.clientY+12) }
            label.onmousemove = (ev)=>{ movePermTip(ev.clientX+12, ev.clientY+12) }
            label.onmouseleave = ()=>{ hidePermTip() }
            label.onclick = (ev)=>{ ev.preventDefault(); }
          }
        } else {
          n.classList.remove('disabled');
          const label = n.closest('label');
          if (label){ label.onmouseenter = null; label.onmousemove = null; label.onmouseleave = null; label.onclick = null; }
          hidePermTip()
        }
      })
      // 区块标识（可用于快速了解能力）
      try{
        if (lv1Area) lv1Area.style.display = 'block'
        if (lv2Area) lv2Area.style.display = 'block'
        if (lv3Area) lv3Area.style.display = 'block'
      }catch{}
    }
    let currentRunId = null;
    if (!state._autoopListenersBound){
      if (autoStart) autoStart.addEventListener('click', async () => {
        const originalText = autoStart.textContent;
        autoStart.textContent = '启动中...';
        autoStart.disabled = true;
        if (autoStatus) autoStatus.textContent = '正在启动...';

        try {
          const g = getUserGroup();
          const perms = getPermissionsByGroup(g);
          
          const timeMap = { '一天内': 1, '一周内': 7, '半年内': 180, '一年内': 365, '不限': 0 };
          const timeVal = autoPublishTime ? autoPublishTime.value : '不限';
          const days = timeMap[timeVal] || 0;

          const payload = {
            industry: autoIndustry ? autoIndustry.value : '',
            type: autoType ? autoType.value : 'image_text',
            keywords: autoKeywords ? autoKeywords.value : '',
            sortType: autoSort ? autoSort.value : 'general',
            noteType: autoType ? autoType.value : '0', // 0=unlimited
            searchScope: autoScope ? autoScope.value : '0', // 0=unlimited
            timeRange: days,
            maxCount: autoCount ? parseInt(autoCount.value, 10) : 200,
            delayRange: autoDelayRange ? autoDelayRange.value : '1-3',
            browseTime: autoBrowseTime ? autoBrowseTime.value : '5-10',
            actions: {
              browse: autoBrowse ? autoBrowse.checked : false,
              record: autoRecord ? autoRecord.checked : false,
              like: perms.canLike && (autoLike ? autoLike.checked : false),
              likeProb: autoLikeProb ? parseInt(autoLikeProb.value, 10) : 100,
              fav: perms.canFav && (autoFav ? autoFav.checked : false),
              favProb: autoFavProb ? parseInt(autoFavProb.value, 10) : 100,
              comment: perms.canComment && (autoComment ? autoComment.checked : false),
              commentProb: autoCommentProb ? parseInt(autoCommentProb.value, 10) : 100
            }
          };

          console.log('Starting auto-op with:', payload);
          const res = await services.ipc.startAutoOp(payload);
          
          if (res && res.ok) {
            console.log('Launched successfully');
            if (autoStatus) autoStatus.textContent = '正在执行';
            setTimeout(() => {
               autoStart.textContent = '执行中';
            }, 1000);
          } else {
            throw new Error((res && res.error) ? res.error : '启动失败');
          }
        } catch (err) {
          console.error(err);
          alert('启动失败: ' + err.message);
          autoStart.textContent = originalText;
          autoStart.disabled = false;
          if (autoStatus) autoStatus.textContent = '启动失败';
        }
      });
      if (autoStop) autoStop.addEventListener('click', async () => {
        if (autoStatus) autoStatus.textContent = '已停止';
        await services.ipc.stopAutoOp({ runId: currentRunId });
      });
      
      // Removed: rankBtn listener
      
      // --- Modal Logic ---
      let currentModalType = '';
      let currentPage = 1;
      let pageSize = 20;
      let totalItems = 0;

      async function loadModalData(page) {
          if (!currentModalType) return;
          currentPage = page;
          modalTbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px">加载中...</td></tr>';
          
          try {
              let res;
              let columns = [];
              
              if (currentModalType === 'notes') {
                  res = await services.ipc.getScrapedNotes(currentPage, pageSize);
                  columns = [
                      { k: 'title', t: '标题', w: '30%' },
                      { k: 'type', t: '类型', w: '10%' },
                      { k: 'liked_count', t: '点赞', w: '10%' },
                      { k: 'collected_count', t: '收藏', w: '10%' },
                      { k: 'comment_count', t: '评论', w: '10%' },
                      { k: 'last_visited_at', t: '采集时间', w: '20%' }
                  ];
              } else if (currentModalType === 'comments') {
                  res = await services.ipc.getScrapedComments(currentPage, pageSize);
                  columns = [
                      { k: 'content', t: '评论内容', w: '40%' },
                      { k: 'user_id', t: '用户ID', w: '15%' }, // or user_name if available
                      { k: 'like_count', t: '点赞', w: '10%' },
                      { k: 'created_at', t: '评论时间', w: '20%' },
                      { k: 'note_id', t: '关联笔记', w: '15%' }
                  ];
              }
              
              if (!res || !res.ok) throw new Error((res && res.error) ? res.error : '加载失败');
              
              const items = res.items || [];
              totalItems = res.total || 0;
              
              // Render Header
              modalThead.innerHTML = '';
              const trh = document.createElement('tr');
              columns.forEach(col => {
                  const th = document.createElement('th');
                  th.style.padding = '12px 8px';
                  th.style.textAlign = 'left';
                  th.style.borderBottom = '1px solid #ddd';
                  th.textContent = col.t;
                  if (col.w) th.style.width = col.w;
                  trh.appendChild(th);
              });
              modalThead.appendChild(trh);
              
              // Render Body
              modalTbody.innerHTML = '';
              if (!items.length) {
                  modalTbody.innerHTML = '<tr><td colspan="'+columns.length+'" style="text-align:center;padding:20px;color:#999">暂无数据</td></tr>';
              } else {
                  items.forEach(it => {
                      const tr = document.createElement('tr');
                      columns.forEach(col => {
                          const td = document.createElement('td');
                          td.style.padding = '8px';
                          td.style.borderBottom = '1px solid #eee';
                          td.style.verticalAlign = 'top';
                          
                          let v = it[col.k];
                          if (col.k.includes('time') || col.k.includes('at')) {
                              try { if(v) v = new Date(v).toLocaleString(); } catch {}
                          }
                          if (col.k === 'type') {
                              v = v === 'video' ? '视频' : '图文';
                          }
                          
                          v = String(v == null ? '' : v);
                          if (v.length > 100) {
                              td.title = v;
                              v = v.slice(0, 100) + '...';
                          }
                          td.textContent = v;
                          tr.appendChild(td);
                      });
                      
                      // Click to open note logic
                      if (currentModalType === 'notes' && it.note_url) {
                          tr.style.cursor = 'pointer';
                          tr.title = '点击打开链接';
                          tr.onclick = () => services.ipc.openExternal(it.note_url);
                      } else if (currentModalType === 'comments' && it.note_id) {
                          tr.style.cursor = 'pointer';
                          tr.title = '点击打开对应笔记';
                          tr.onclick = () => services.ipc.openExternal(`https://www.xiaohongshu.com/explore/${it.note_id}`);
                      }
                      
                      modalTbody.appendChild(tr);
                  });
              }
              
              // Update Footer
              const totalPages = Math.ceil(totalItems / pageSize) || 1;
              modalPageInfo.textContent = `${currentPage} / ${totalPages} (共 ${totalItems} 条)`;
              modalPrev.disabled = currentPage <= 1;
              modalNext.disabled = currentPage >= totalPages;
              
          } catch (e) {
              console.error(e);
              modalTbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:red">加载错误: ${e.message}</td></tr>`;
          }
      }

      function openModal(type) {
          currentModalType = type;
          modalTitle.textContent = type === 'notes' ? '采集笔记列表' : '采集评论列表';
          modalOverlay.style.display = 'flex';
          loadModalData(1);
      }

      if (viewNotesBtn) viewNotesBtn.addEventListener('click', () => openModal('notes'));
      if (viewCommentsBtn) viewCommentsBtn.addEventListener('click', () => openModal('comments'));
      
      if (modalClose) modalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
      if (modalPrev) modalPrev.addEventListener('click', () => { if(currentPage > 1) loadModalData(currentPage - 1); });
      if (modalNext) modalNext.addEventListener('click', () => { loadModalData(currentPage + 1); }); // Bound check inside load
      
      // Close on outside click
      if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) modalOverlay.style.display = 'none';
      });

      state._autoopListenersBound = true;
    }
    document.getElementById('login-card').style.display = 'none';
    const platformsCard = document.getElementById('platforms-card');
    const opsCard = document.getElementById('ops-card');
    if (platformsCard) platformsCard.style.display = 'none';
    if (opsCard) opsCard.style.display = 'none';
    document.getElementById('autoop-card').style.display = 'block';
    applyPermissions()
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('title').textContent = '自动运营（简化）';
    window.AppView = 'autoop';
    
    // Load Industries
    (async ()=>{
      if (!autoIndustry) return;
      try {
        const res = await services.ipc.getIndustries();
        if (res.ok && res.items && res.items.length) {
            autoIndustry.innerHTML = '';
            res.items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.code;
                opt.textContent = it.name;
                autoIndustry.appendChild(opt);
            });
            // Select insurance if exists as requested
            if (res.items.find(i=>i.code==='insurance')) autoIndustry.value='insurance';
        } else {
            autoIndustry.innerHTML = '<option value="" disabled>无数据</option>';
        }
      } catch(e) { console.error(e); autoIndustry.innerHTML = '<option value="" disabled>加载失败</option>'; }
    })();
  }
  function unmount(){
    const c = document.getElementById('autoop-card');
    if (c) c.style.display = 'none';
  }
  window.Views = window.Views || {};
  window.Views.autoop = { mount, unmount };
})();
;(function(){
  const t = document.getElementById('autoop-toggle-log');
  const l = document.getElementById('autoop-log');
  if (l) l.style.display = 'none';
  if (t) t.style.display = 'none';
})();
      let currentStage = '';
