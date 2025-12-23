function stageDefaults(stage){
  const s = String(stage||'').trim();
  if (s==='search_focus' || s==='search_input'){
    return [
      'input[placeholder*="搜索" i]',
      'input[type="search" i]',
      'input[aria-label*="搜索" i]',
      'input'
    ];
  }
  if (s==='search_click'){
    return [
      'button[type="submit" i]',
      'button',
      '[role="button" i]'
    ];
  }
  if (s==='browse_list'){
    return [
      'a[href^="/explore/" i]',
      'a[href*="/explore/" i]',
      'article[role="article" i] a[href]'
    ];
  }
  if (s==='open_item' || s==='open_next_item'){
    return [
      'a[href^="/explore/" i]',
      'a[href*="/explore/" i]'
    ];
  }
  return [];
}

module.exports = { stageDefaults };

