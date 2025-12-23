;(function(){
  async function mount(ctx){
    const { services, state } = ctx;
    const platformsCard = document.getElementById('platforms-card');
    const platformsEl = document.getElementById('platforms');
    const platformsEmpty = document.getElementById('platforms-empty');
    const opsCard = document.getElementById('ops-card');
    const autopubCard = document.getElementById('autopub-card');
    platformsEl.innerHTML = '';
    platformsEmpty.style.display = 'none';
    const list = await services.ipc.getUserPlatforms();
    if (!list || list.length === 0) {
      platformsEmpty.style.display = 'block';
    } else {
      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `<div style="font-weight:600">${item.name}</div><div class="muted">${item.code}</div><div style="margin-top:12px"><button data-code="${item.code}">进入</button></div>`;
        div.querySelector('button').addEventListener('click', async () => {
          state.selectedPlatform = item.code;
          if (window.AppNavigate) window.AppNavigate('ops');
        });
        platformsEl.appendChild(div);
      });
    }
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('title').textContent = '平台选择';
    window.AppView = '平台选择' ? 'platforms' : 'platforms';
  }
  function unmount(){
    const c = document.getElementById('platforms-card');
    if (c) c.style.display = 'none';
  }
  window.Views = window.Views || {};
  window.Views.platforms = { mount, unmount };
})();
