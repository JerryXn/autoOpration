;(function(){
  function mount(ctx){
    const { services, state } = ctx;
    const form = document.getElementById('login-form');
    const msg = document.getElementById('login-msg');
    const quickBtn = document.getElementById('quick-admin-btn');
    const topbar = document.getElementById('topbar');
    const title = document.getElementById('title');
    document.getElementById('login-card').style.display = 'block';
    document.getElementById('topbar').style.display = 'flex';
    title.textContent = '登录';
    window.AppView = 'login';
    if (form) {
      form.onsubmit = async e => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        msg.textContent = '';
        const res = await services.ipc.login(username, password);
        if (res && res.ok) {
          state.userId = res.userId;
          try{ state.user = { id: res.user && res.user.id, name: res.user && res.user.name, group: res.user && res.user.group }; localStorage.setItem('userGroup', res.user && res.user.group ? res.user.group : 'admin'); }catch{}
          if (window.AppNavigate) window.AppNavigate('platforms');
        } else {
          msg.textContent = res && res.error ? res.error : '登录失败';
        }
      };
    }
    if (quickBtn) {
      quickBtn.addEventListener('click', async () => {
        msg.textContent = '';
        const res = await services.ipc.quickAdminLogin();
        if (res && res.ok) {
          state.userId = res.userId;
          try{ state.user = { id: res.user && res.user.id, name: res.user && res.user.name, group: res.user && res.user.group }; localStorage.setItem('userGroup', res.user && res.user.group ? res.user.group : 'admin'); }catch{}
          if (window.AppNavigate) window.AppNavigate('platforms');
        } else {
          msg.textContent = res && res.error ? res.error : '快捷登录失败';
        }
      });
    }
  }
  function unmount(){
    const c = document.getElementById('login-card');
    if (c) c.style.display = 'none';
  }
  window.Views = window.Views || {};
  window.Views.login = { mount, unmount };
})();
