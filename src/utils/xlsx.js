;(function(){
  function genTemplate(){
    const aoa = [
      ['标题','文案','封面','配图'],
      ['示例标题','这是文案','cover01.jpg','img01.png,img02.png']
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '自动发布模板.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function parseExcelFile(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const data = new Uint8Array(reader.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const rows = json.map(r=>({
            title: r['标题'] ?? r['title'] ?? '',
            content: r['文案'] ?? r['content'] ?? '',
            cover: r['封面'] ?? r['cover'] ?? '',
            images: r['配图'] ?? r['images'] ?? ''
          }));
          resolve(rows);
        }catch(e){ reject(e); }
      };
      reader.onerror = ()=>reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
  function exportResult(rows, missingByRow){
    const aoa = [['标题','文案','封面','配图','封面匹配状态','配图匹配状态']];
    rows.forEach((r,idx)=>{
      const m = missingByRow[idx] || { missCover: [], missImages: [] };
      aoa.push([
        r.title || r.标题 || '',
        r.content || r.文案 || '',
        r.cover || r.封面 || '',
        r.images || r.配图 || '',
        m.missCover.length ? `缺失: ${m.missCover.join(', ')}` : '全部匹配',
        m.missImages.length ? `缺失: ${m.missImages.join(', ')}` : '全部匹配'
      ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, '解析结果');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '自动发布解析结果.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  window.Utils = window.Utils || {};
  window.Utils.xlsx = { genTemplate, parseExcelFile, exportResult };
})();