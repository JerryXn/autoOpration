;(function(){
  const api = window.api || {};
  const ipc = {
    login: (u,p) => api.login(u,p),
    getUserPlatforms: () => api.getUserPlatforms(),
    getPlatformFeatures: (code) => api.getPlatformFeatures(code),
    openPlatform: (code) => api.openPlatform(code),
    fetchFeishu: (url) => api.fetchFeishu(url),
    saveParsedContent: (payload) => api.saveParsedContent(payload),
    listParsedContents: (platformCode, page, pageSize, status) => api.listParsedContents(platformCode, page, pageSize, status),
    getPublishSchedules: (platformCode) => api.getPublishSchedules(platformCode),
    savePublishSchedules: (platformCode, slots) => api.savePublishSchedules(platformCode, slots),
    markPublished: (id) => api.markPublished(id),
    startWebPublish: (id) => api.startWebPublish(id)
    ,quickAdminLogin: () => api.quickAdminLogin()
    ,startAutoOp: (payload) => api.startAutoOp(payload)
    ,stopAutoOp: (runId) => api.stopAutoOp(runId)
    ,listAutoOpRuns: () => api.listAutoOpRuns()
    ,getScrapedNotes: (page, pageSize) => api.getScrapedNotes(page, pageSize)
    ,getScrapedComments: (page, pageSize) => api.getScrapedComments(page, pageSize)
    ,getIndustries: () => api.getIndustries()
    ,fetchXhsRank: () => api.fetchXhsRank()
    ,openExternal: (url) => api.openExternal(url)
  };
  window.Services = window.Services || {};
  window.Services.ipc = ipc;
})();
