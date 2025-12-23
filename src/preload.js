const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('login', { username, password }),
  getUserPlatforms: () => ipcRenderer.invoke('get-user-platforms'),
  getPlatformFeatures: (platformCode) => ipcRenderer.invoke('get-platform-features', { code: platformCode }),
  openPlatform: (platformCode) => ipcRenderer.invoke('open-platform', { code: platformCode }),
  fetchFeishu: (url) => ipcRenderer.invoke('feishu-fetch', { url }),
  saveParsedContent: (payload) => ipcRenderer.invoke('save-parsed-content', payload),
  listParsedContents: (platformCode, page, pageSize, status) => ipcRenderer.invoke('list-parsed-contents', { platformCode, page, pageSize, status })
  ,getPublishSchedules: (platformCode) => ipcRenderer.invoke('get-publish-schedules', { platformCode })
  ,savePublishSchedules: (platformCode, slots) => ipcRenderer.invoke('save-publish-schedules', { platformCode, slots })
  ,markPublished: (id) => ipcRenderer.invoke('mark-published', { id })
  ,startWebPublish: (id) => ipcRenderer.invoke('start-web-publish', { id })
  ,openDevTools: () => ipcRenderer.invoke('open-devtools')
  ,quickAdminLogin: () => ipcRenderer.invoke('quick-admin-login')
  ,startAutoOp: (payload) => ipcRenderer.invoke('start-auto-op', payload)
  ,stopAutoOp: (runId) => ipcRenderer.invoke('stop-auto-op', { runId })
  ,listAutoOpRuns: () => ipcRenderer.invoke('list-auto-op-runs')
  ,getScrapedNotes: (page, pageSize) => ipcRenderer.invoke('get-scraped-notes', { page, pageSize })
  ,getScrapedComments: (page, pageSize) => ipcRenderer.invoke('get-scraped-comments', { page, pageSize })
  ,getIndustries: () => ipcRenderer.invoke('get-industries')
  ,fetchXhsRank: () => ipcRenderer.invoke('fetch-xhs-rank')
  ,openExternal: (url) => ipcRenderer.invoke('open-external', { url })
});
