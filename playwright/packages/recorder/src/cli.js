const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(query, resolve));

(async () => {
  console.log('--- 开始录制脚本 ---');

  // 1. 获取脚本名称 (必填)
  let name = '';
  while (!name) {
    name = await ask('请输入脚本名称 (Script Name) [必填]: ');
    if (!name) console.log('脚本名称不能为空！');
  }

  // 2. 获取目标 URL (必填)
  let url = '';
  while (!url) {
    url = await ask('请输入目标 URL (Target URL) [必填]: ');
    if (!url) console.log('目标 URL 不能为空！');
  }

  // 3. 处理登录状态
  const storageDir = path.join(process.cwd(), 'data', 'storage');
  let storageFile = null;
  
  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      console.log('\n发现以下已保存的登录状态:');
      files.forEach((f, i) => console.log(`${i + 1}. ${f}`));
      
      const ans = await ask('\n请输入序号选择要继承的状态 (留空则不继承): ');
      const idx = parseInt(ans);
      if (!isNaN(idx) && idx > 0 && idx <= files.length) {
        storageFile = path.join(storageDir, files[idx - 1]);
        console.log(`已选择状态文件: ${files[idx - 1]}`);
      }
    }
  }

  rl.close();

  // 4. 准备目录
  const outDir = path.join(process.cwd(), 'scripts', name);
  const outFile = path.join(outDir, 'index.js');
  const metaFile = path.join(outDir, 'script.json');

  if (fs.existsSync(outDir)) {
    console.log(`\n警告: 脚本目录 ${name} 已存在，将被覆盖。`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 5. 写入元数据
  const meta = {
    name,
    entry: 'index.js',
    url,
    defaultOptions: {
      channel: 'chrome',
      headless: false,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    }
  };
  
  if (storageFile) {
    const key = path.basename(storageFile, '.json');
    meta.defaultOptions.storageKey = key;
    meta.defaultOptions.persistLogin = true;
  }

  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  console.log(`\n正在启动 Playwright Codegen...`);
  console.log(`目标: ${url}`);
  console.log(`输出: ${outFile}`);

  const args = ['playwright', 'codegen', url, '--target', 'javascript', '--output', outFile];
  
  if (storageFile) {
    args.push('--load-storage', storageFile);
    args.push('--save-storage', storageFile); 
  }

  const p = spawn('npx', args, {
    stdio: 'inherit',
    shell: true
  });


  p.on('exit', (code) => {
    console.log(`\n录制结束 (Exit code: ${code})`);
    
    // 自动转换脚本格式以适配 Worker Runtime
    try {
      let content = fs.readFileSync(outFile, 'utf8');
      
      // 1. 移除 require
      content = content.replace(/const \{ chromium \} = require\('playwright'\);\n*/, '');
      
      // 2. 替换头部，注入 utils
      content = content.replace(/\(async \(\) => \{/, 'module.exports = {\n  run: async ({ page, context, browser, utils }) => {');
      
      // 3. 移除初始化代码 (非贪婪匹配，处理可能的换行)
      content = content.replace(/const browser = await chromium\.launch\(\{[\s\S]*?\}\);\n/, '');
      content = content.replace(/const context = await browser\.newContext\(\{[\s\S]*?\}\);\n/, '');
      content = content.replace(/const page = await context\.newPage\(\);\n/, '');
      
      // 3.5 插入登录检查逻辑 (如果用户提供了目标 URL，则默认认为非目标 URL 即为未登录或需要登录)
      // 使用更智能的判断：检查是否需要注入守卫
      if (url) {
        // 在第一行 page.goto 之后插入
        const gotoRegex = new RegExp(`await page\\.goto\\('${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\);`);
        const loginGuard = `\n    // 智能登录守卫：如果未登录则暂停等待\n    await utils.ensureLogin({ urlPattern: /login|signin|auth/i });\n`;
        
        if (content.match(gotoRegex)) {
           content = content.replace(gotoRegex, `await page.goto('${url}');${loginGuard}`);
        } else {
           // 如果找不到精确的 goto，则插在函数开头
           content = content.replace(/run: async \(\{.*?\}\) => \{/, `$&${loginGuard}`);
        }
      }
      
      // 4. 移除尾部清理代码
      content = content.replace(/await context\.storageState\(\{[\s\S]*?\}\);\n/, ''); // 由 Runtime 接管
      content = content.replace(/await context\.close\(\);\n/, '');
      content = content.replace(/await browser\.close\(\);\n/, '');
      
      // 5. 替换尾部闭合
      content = content.replace(/\}\)\(\);/, '  }\n};');

      fs.writeFileSync(outFile, content);
      console.log('脚本已自动转换为 Worker Runtime 格式。');
    } catch (err) {
      console.error('转换脚本格式失败:', err);
    }

    console.log(`脚本已保存至: ${outFile}`);
    console.log(`元数据已保存至: ${metaFile}`);
    console.log(`\n您可以运行: npm run cli -- run ${name} 来执行此脚本。`);
  });

})();
