const https = require('https');

class CozeClient {
  /**
   * @param {string} botId - Coze Bot ID
   * @param {string} patToken - Personal Access Token (PAT)
   * @param {object} config - 额外配置，如 timeout
   */
  constructor(botId, patToken, config = {}) {
    this.botId = botId;
    this.token = patToken;
    this.hostname = 'api.coze.cn';
    this.timeout = config.timeout || 10000; // 默认 10s
  }

  /**
   * 发送消息给 Coze Bot 并获取回复
   * @param {string} query - 用户输入的内容
   * @param {string} userId - 用户标识 (可选)
   * @returns {Promise<string>} - Bot 的回复内容
   */
  async chat(query, userId = 'default_user') {
    if (!this.token || this.token.includes('YOUR_PAT')) {
      console.warn('[Coze] Warning: Invalid PAT token. Please configure it in config.json');
      return '（Coze Token 未配置，无法生成回复）';
    }

    const payload = JSON.stringify({
      bot_id: this.botId,
      user_id: userId,
      stream: true, 
      auto_save_history: true,
      additional_messages: [
        {
          role: 'user',
          content: query,
          content_type: 'text'
        }
      ]
    });

    const options = {
      hostname: this.hostname,
      path: '/v3/chat',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: this.timeout // 设置 HTTP 请求超时
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
           let errData = '';
           res.on('data', c => errData += c);
           res.on('end', () => reject(new Error(`Coze API failed with status ${res.statusCode}: ${errData}`)));
           return;
        }

        let fullReply = '';
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          
          let lines = buffer.split(/\r?\n/);
          buffer = lines.pop(); 

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('data:')) {
              const jsonStr = line.substring(5).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                
                // --- 进阶过滤逻辑 (Synced from test-coze.js) ---
                const msgType = data.type || (data.message && data.message.type);
                const eventType = data.event;

                // 剔除追问 (Follow-up) 和 冗余信息 (Verbose)
                if (msgType === 'follow_up' || msgType === 'verbose') continue;

                // 剔除 "Completed" 事件
                if (eventType && (eventType.endsWith('.completed') || eventType === 'done')) continue;

                // 提取内容
                let content = data.content || (data.message && data.message.content);
                
                if (content && typeof content === 'string') {
                    // 清洗 JSON 垃圾
                    if (content.trim().startsWith('{') && content.includes('"msg_type"')) {
                        continue;
                    }
                    // 清洗布尔值字符串 (例如 "false", "true")
                    if (content.trim() === 'false' || content.trim() === 'true') {
                        if (!hasLoggedBooleanFilter) {
                            console.log(`[Coze] Filtered out boolean response: "${content.trim()}"`);
                            hasLoggedBooleanFilter = true;
                        }
                        continue;
                    }
                    
                    fullReply += content;
                }
                // ---------------------------------------------
              } catch (e) {
                // ignore
              }
            }
          }
        });

        res.on('end', () => {
          if (fullReply.length > 0) {
            // 智能去重逻辑
            const len = fullReply.length;
            if (len > 0 && len % 2 === 0) {
                const mid = len / 2;
                const first = fullReply.substring(0, mid);
                const second = fullReply.substring(mid);
                if (first === second) {
                    console.log('[Coze] Detected duplicate response, deduplicating...');
                    fullReply = first;
                }
            }
            resolve(fullReply);
          } else {
            resolve('（AI 未返回有效内容）');
          }
        });
      });

      // 超时处理
      req.on('timeout', () => {
        req.destroy();
        console.warn(`[Coze] Request timed out after ${this.timeout}ms`);
        resolve(''); // 超时返回空字符串，不中断主流程
      });

      req.on('error', (e) => {
        console.error(`[Coze] Request error: ${e.message}`);
        resolve(''); // 出错也返回空，保证爬虫继续运行
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = CozeClient;
