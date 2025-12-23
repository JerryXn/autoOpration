function buildQueue(stage){
  const s = String(stage||'').trim();
  if (s==='search_focus'){
    return [
      { type:'query_selector', stage:'search_focus' },
      { type:'move_to' },
      { type:'click' },
      { type:'wait', ms: 200 }
    ];
  }
  if (s==='search_input'){
    return [
      { type:'text_input' },
      { type:'wait', ms: 200 }
    ];
  }
  if (s==='search_click'){
    return [
      { type:'query_selector', stage:'search_click' },
      { type:'click' },
      { type:'wait', ms: 300 }
    ];
  }
  if (s==='browse_list'){
    return [
      { type:'wait', ms: 400 }
    ];
  }
  if (s==='open_item'){
    return [
      { type:'program_click', stage:'open_item' },
      { type:'wait', ms: 300 },
      { type:'detect_restricted' }
    ];
  }
  if (s==='browse_detail'){
    return [
      { type:'wait', ms: 600 }
    ];
  }
  if (s==='back_to_list'){
    return [
      { type:'program_back' },
      { type:'wait', ms: 300 }
    ];
  }
  if (s==='open_next_item'){
    return [
      { type:'query_selector_next', stage:'open_next_item' },
      { type:'click' },
      { type:'wait', ms: 400 },
      { type:'detect_restricted' }
    ];
  }
  return [ { type:'wait', ms: 200 } ];
}

module.exports = { buildQueue };

