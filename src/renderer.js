document.addEventListener('DOMContentLoaded', () => {
  const services = window.Services;
  const state = { userId: null, selectedPlatform: null };
  const back = document.getElementById('back');

  function showOnly(id){
    const ids = ['login-card','platforms-card','ops-card','autopub-card','autoop-card'];
    ids.forEach(i=>{ const el=document.getElementById(i); if(el) el.style.display = (i===id)?'block':'none'; });
  }

  async function navigate(view){
    window.history.pushState({ view }, '', `?view=${view}`);
    window.AppView = view;
    if (view === 'login') {
      showOnly('login-card');
      window.Views.login.mount({ services, state });
    } else if (view === 'platforms') {
      showOnly('platforms-card');
      await window.Views.platforms.mount({ services, state });
    } else if (view === 'ops') {
      showOnly('ops-card');
      await window.Views.ops.mount({ services, state });
    } else if (view === 'autopublish') {
      showOnly('autopub-card');
      window.Views.autopublish.mount({ el: document.getElementById('autopub-card'), services, state });
    } else if (view === 'autoop') {
      showOnly('autoop-card');
      window.Views.autoop.mount({ el: document.getElementById('autoop-card'), services, state });
    }
  }

  if (back) back.addEventListener('click', () => {
    const v = window.AppView;
    if (v === 'autopublish' || v === 'autoop') navigate('ops');
    else if (v === 'ops') navigate('platforms');
    else navigate('login');
  });

  window.AppNavigate = navigate;
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('view') || 'login';
  navigate(initial);
});
