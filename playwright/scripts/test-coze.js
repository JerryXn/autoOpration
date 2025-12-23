const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. 读取配置
let config = {};
try {
  const configPath = path.join(__dirname, 'xiaohongshu/config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load config:', e.message);
  process.exit(1);
}

const BOT_ID = config.coze?.bot_id;
const PAT_TOKEN = config.coze?.pat_token;

if (!BOT_ID || !PAT_TOKEN || PAT_TOKEN.includes('YOUR_PAT')) {
  console.error('Error: Please set valid bot_id and pat_token in scripts/xiaohongshu/config.json');
  process.exit(1);
}

console.log(`[Test] Testing Coze Bot ID: ${BOT_ID}`);

// 2. 获取用户输入的消息 (从命令行参数)
const userQuery = process.argv[2] || 'hi';
console.log(`[Test] Sending message: "${userQuery}"`);

const requestData = JSON.stringify({
  bot_id: BOT_ID,
  user_id: 'test_user_001',
  stream: true, // 开启流式
  auto_save_history: true,
  additional_messages: [
    {
      role: 'user',
      content: userQuery,
      content_type: 'text'
    }
  ]
});

const options = {
  hostname: 'api.coze.cn',
  path: '/v3/chat',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PAT_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

console.log('[Test] Waiting for Coze response...');

const req = https.request(options, (res) => {
  if (res.statusCode !== 200) {
    console.error(`[Test] Request failed with status ${res.statusCode}`);
    res.pipe(process.stdout);
    return;
  }

  let fullReply = '';
  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // 更稳健的 SSE 解析：兼容 \r\n 和 \n
    let lines = buffer.split(/\r?\n/);
    
    // 如果最后一行不是空的，说明数据不完整，留到下一次处理
    buffer = lines.pop(); 

    for (const line of lines) {
      if (!line.trim()) continue; // 跳过空行
      if (line.startsWith('data:')) {
        const jsonStr = line.substring(5).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);
          
          // --- 进阶过滤逻辑 ---
          
          // 1. 获取消息类型 (可能在顶层，也可能在 message 对象里)
          const msgType = data.type || (data.message && data.message.type);
          const eventType = data.event;

          // 2. 剔除追问 (Follow-up) 和 冗余信息 (Verbose)
          if (msgType === 'follow_up' || msgType === 'verbose') continue;

          // 3. 剔除 "Completed" 事件 (因为它通常包含完整的重复文本，导致双倍快乐)
          if (eventType && (eventType.endsWith('.completed') || eventType === 'done')) continue;

          // 4. 必须是 'answer' 类型 (或者类型未知的兜底，但前面已经过滤了 bad types)
          // 为了保险，如果能获取到 type，必须是 answer
          if (msgType && msgType !== 'answer') continue;

          // 5. 提取内容
          let content = data.content || (data.message && data.message.content);
          
          if (content) {
              // 清洗 JSON 垃圾
              if (content.trim().startsWith('{') && content.includes('"msg_type"')) {
                  continue;
              }
              fullReply += content;
          }
          // -------------------

        } catch (e) {
          // ignore
        }
      }
    }
  });

  res.on('end', () => {
    console.log('\n\n[Test] Stream ended.');
    if (fullReply.length > 0) {
        console.log('------------------------------------------------');
        console.log('Final Captured Reply:');
        console.log(fullReply);
        console.log('------------------------------------------------');
    } else {
        console.log('[Test] Warning: No content captured. Please check if your PAT has permission or if the Bot is published.');
    }
  });
});

req.on('error', (e) => {
  console.error(`[Test] Request error: ${e.message}`);
});

req.write(requestData);
req.end();
