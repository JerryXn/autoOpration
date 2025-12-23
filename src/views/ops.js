;(function(){
  async function mount(ctx){
    const { services, state } = ctx;
    const opsTitle = document.getElementById('ops-title');
    const featuresEl = document.getElementById('features');
    const autopubCard = document.getElementById('autopub-card');
    const autoopCard = document.getElementById('autoop-card');
    const platformsCard = document.getElementById('platforms-card');
    if (opsTitle) opsTitle.style.display = 'none';
    featuresEl.innerHTML = '';
    const list = await services.ipc.getPlatformFeatures(state.selectedPlatform);
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      const isPublish = item.code === 'publish';
      const isPublishImageText = item.code === 'publish_image_text';
      const isPublishVideo = item.code === 'publish_video';
      const isAutoOp = item.code === 'auto_operation';
      const btnText = isPublish ? '发布' : (isPublishImageText ? '上传图文' : (isPublishVideo ? '上传视频' : '执行'));
      div.innerHTML = `<div style="font-weight:600">${item.name}</div><div class="muted">${item.code}</div><div style="margin-top:12px"><button data-code="${item.code}">${btnText}</button></div>`;
      div.querySelector('button').addEventListener('click', async () => {
        if (isPublish || isPublishImageText || isPublishVideo) {
          if (window.AppNavigate) window.AppNavigate('autopublish');
        } else if (isAutoOp) {
          if (window.AppNavigate) window.AppNavigate('autoop');
        } else {
          await services.ipc.openPlatform(state.selectedPlatform);
        }
      });
      featuresEl.appendChild(div);
    });
    featuresEl.style.display = 'block';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('title').textContent = '功能选择';
    window.AppView = 'ops';
  }
  function unmount(){
    const opsCard = document.getElementById('ops-card');
    if (opsCard) opsCard.style.display = 'none';
  }
  window.Views = window.Views || {};
  window.Views.ops = { mount, unmount };
})();
