const path = require('path');
const fs = require('fs');
const CozeClient = require('../utils/coze-client');
const { applyFilter } = require('./filter-handler'); // 引入筛选模块

// 读取配置
let config = {
  search: { keyword: '保险' },
  limits: { maxNotes: 30, maxComments: 50 },
  actions: { like: true, likeRate: 80, collect: true, collectRate: 40, comment: true, commentText: '学到啦！', reply: true, replyText: '学到啦' },
  crawler: { includeReplies: false },
  coze: { enabled: false, bot_id: '', pat_token: '' },
  system: { http: { timeout: 10000 }, actionDelay: { min: 1000, max: 3000 } }
};

try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(fileContent);
    console.log('[Config] Loaded config from config.json');
  }
} catch (e) {
  console.log('[Config] Failed to load config.json, using defaults.');
}

// 初始化 Coze 客户端
const cozeClient = new CozeClient(
    config.coze?.bot_id, 
    config.coze?.pat_token,
    { timeout: config.system?.http?.timeout } // 传入超时配置
);

// 辅助函数：随机延迟
const humanDelay = async (page) => {
    const min = config.system?.actionDelay?.min || 1000;
    const max = config.system?.actionDelay?.max || 3000;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    // console.log(`[Delay] Waiting for ${delay}ms...`);
    await page.waitForTimeout(delay);
};

// 辅助函数：概率判断
const shouldPerformAction = (rate) => {
    // 如果 rate 未定义，默认 100%
    const threshold = rate !== undefined ? rate : 100;
    const random = Math.floor(Math.random() * 100) + 1; // 1-100
    // console.log(`[Probability] Rolled ${random}, Threshold ${threshold}`);
    return random <= threshold;
};

module.exports = {
  run: async ({ page, context, browser, utils }) => {
    console.log('[Script] Starting Xiaohongshu scraper...');
    console.log(`[Config] Max Notes: ${config.limits.maxNotes}, Keyword: "${config.search.keyword}"`);
    
    if (config.coze?.enabled) {
        console.log('[Config] Coze AI Agent is ENABLED.');
    }
    
    await page.goto('https://www.xiaohongshu.com/explore');
    // 智能登录守卫：如果未登录则暂停等待
    await utils.ensureLogin({ urlPattern: /login|signin|auth/i });

    // 执行搜索流程
    console.log(`[Script] Searching for "${config.search.keyword}"...`);
    await page.getByRole('textbox', { name: '搜索小红书' }).click();
    await humanDelay(page);
    await page.getByRole('textbox', { name: '搜索小红书' }).fill(config.search.keyword);
    await humanDelay(page);
    await page.locator('#global > div.header-container > header > div.input-box > div > div.search-icon > svg').click();
    
    // 等待搜索结果初步加载
    await page.waitForTimeout(2000);

    // --- 应用筛选 ---
    await applyFilter(page, config);
    // ----------------
    
    // 等待搜索结果容器加载
    const containerSelector = '#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__main > div.feeds-container';
    try {
      await page.waitForSelector(containerSelector, { timeout: 15000 });
    } catch (e) {
      console.log('[Error] Search results container not found.');
      return;
    }

    // 状态统计
    const seenUrls = new Set();
    let noNewItemsCount = 0; // 连续未发现新条目的次数，用于防死循环

    console.log(`[Script] Starting infinite scroll scrape. Target: ${config.limits.maxNotes} items.`);

    while (seenUrls.size < config.limits.maxNotes && noNewItemsCount < 5) {
      // 1. 提取当前页面所有 Items
      const itemsData = await extractItems(page, containerSelector);

      // 2. 过滤去重
      const newItems = itemsData.filter(item => {
        if (item.detailUrl && !seenUrls.has(item.detailUrl)) {
          seenUrls.add(item.detailUrl);
          return true;
        }
        return false;
      });

      // 3. 统计与反馈
      if (newItems.length > 0) {
        console.log(`\n[Scrape] Found ${newItems.length} new items. Progress: ${seenUrls.size}/${config.limits.maxNotes}`);
        // 打印详情
        newItems.forEach(item => {
           console.log(JSON.stringify(item, null, 2));
        });

        // --- 批量处理当前页面的新笔记 ---
        console.log(`\n[Interact] Starting batch interaction with ${newItems.length} items...`);
        
        for (const item of newItems) {
            // 系统级异常处理：确保单篇笔记的失败不会中断整个任务
            try {
                if (item && item.detailUrl) {
                    console.log(`\n[Interact] Processing item: ${item.title}`);
                    // 传入 context 以便创建新页面，处理完后自动关闭
                    await interactWithItem(context, item);
                    
                    // 增加一点冷却时间，防止因为关闭不及时导致并发过高
                    await page.waitForTimeout(1000);

                    // 每篇笔记处理完后随机休息一下
                    const restTime = 2000 + Math.random() * 3000;
                    console.log(`[Interact] Item finished. Resting for ${Math.floor(restTime)}ms...`);
                    await page.waitForTimeout(restTime);
                }
            } catch (itemError) {
                // 如果是浏览器关闭导致的错误，直接退出
                const errMsg = itemError.message || '';
                if (errMsg.includes('Target page, context or browser has been closed') || 
                    errMsg.includes('Browser has been closed') ||
                    errMsg.includes('closed') ||
                    errMsg.includes('Session closed')) {
                    console.error('[System] Browser closed detected during item processing. Exiting...');
                    process.exit(0);
                }

                console.error(`[System] Critical error processing item "${item.title || 'Unknown'}": ${itemError.message}`);
                console.error('[System] Recovering... Moving to next item.');
                // 这里不需要 break，直接继续下一次循环即可
            }
        }
        console.log('[Interact] Batch completed. Continuing scroll...');
        // ----------------------------------------------------

        noNewItemsCount = 0;
      } else {
        console.log(`[Scrape] No new items found in this scroll... (Progress: ${seenUrls.size}/${config.limits.maxNotes})`);
        noNewItemsCount++;
      }

      // 检查是否达到目标
      if (seenUrls.size >= config.limits.maxNotes) {
        console.log('[Script] Reached target item count.');
        break;
      }

      // 4. 模拟人为滚动
      await page.evaluate(() => {
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
      });

      // 5. 随机等待 (防风控 & 等待加载)
      await humanDelay(page);
    }

    console.log(`\n[Script] Scraping finished. Total unique items collected: ${seenUrls.size}`);
  }
};

/**
 * 提取页面中所有笔记卡片的详细信息
 * @param {import('playwright').Page} page 
 * @param {string} selector 容器选择器
 */
async function extractItems(page, selector) {
  return await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return [];
    
    // 获取所有笔记卡片 (section.note-item)
    const items = Array.from(container.querySelectorAll('section.note-item')); 
    
    return items.map((item, index) => {
      // 辅助函数：安全获取属性或文本
      const getLink = (s) => {
        const el = item.querySelector(s);
        return el ? el.getAttribute('href') : null;
      };
      const getSrc = (s) => {
        const el = item.querySelector(s);
        return el ? el.getAttribute('src') : null;
      };
      const getText = (s) => {
        const el = item.querySelector(s);
        return el ? el.innerText.trim() : '';
      };

      const detailHref = getLink('a.cover');
      const profileHref = getLink('.footer .author');
      
      return {
        // 关键标识
        detailUrl: detailHref ? `https://www.xiaohongshu.com${detailHref}` : null,
        type: item.querySelector('.play-icon') ? 'video' : 'image',
        
        // 内容详情
        title: getText('.footer .title span'),
        coverUrl: getSrc('a.cover img'),
        
        // 作者信息
        author: getText('.footer .author .name'),
        authorUrl: profileHref ? `https://www.xiaohongshu.com${profileHref}` : null,
        avatarUrl: getSrc('.footer .author img'),
        
        // 互动数据
        time: getText('.footer .author .time'),
        likes: getText('.footer .like-wrapper .count'),
      };
    });
  }, selector);
}

/**
 * 在新页面中与笔记进行互动
 * @param {import('playwright').BrowserContext} context 
 * @param {object} item 
 */
async function interactWithItem(context, item) {
  const page = await context.newPage();
  
  // 注入 humanDelay 辅助函数到 page 上下文，或者直接在这里复用
  const delay = async () => {
      const min = config.system?.actionDelay?.min || 1000;
      const max = config.system?.actionDelay?.max || 3000;
      await page.waitForTimeout(Math.floor(Math.random() * (max - min + 1)) + min);
  };

  try {
    console.log(`[Interact] Opening detail page: ${item.detailUrl}`);
    await page.goto(item.detailUrl);
    await delay();
    
    // 等待笔记内容加载
    const contentSelector = '#noteContainer > div.interaction-container > div.note-scroller > div.note-content';
    await page.waitForSelector(contentSelector, { timeout: 10000 });

    // --- 抓取详情内容 ---
    const detail = await extractNoteDetail(page, contentSelector);
    console.log('\n[Interact] Note Detail Parsed:');
    console.log(JSON.stringify(detail, null, 2));

    // --- 抓取评论 (含无限滚动) ---
    // 评论容器选择器
    const commentsSelector = '#noteContainer > div.interaction-container > div.note-scroller > div.comments-el';
    // 滚动容器 (用于触发加载)
    const scrollerSelector = '#noteContainer > div.interaction-container > div.note-scroller';

    // 滚动到评论区以触发初步加载
    await page.locator(commentsSelector).scrollIntoViewIfNeeded();
    await delay();

    // 评论抓取配置
    const INCLUDE_REPLIES = config.crawler.includeReplies;
    const MAX_COMMENTS_TARGET = config.limits.maxComments;
    const END_MARKER_SELECTOR = '#noteContainer .comments-el .end-container'; // 评论结束标记
    
    let allComments = [];
    const seenCommentKeys = new Set();
    let noNewCommentsCount = 0;
    let hasReplied = false; // 是否已执行过回复

    console.log(`[Interact] Starting comment scrape. Target: ${MAX_COMMENTS_TARGET}`);

    while (allComments.length < MAX_COMMENTS_TARGET && noNewCommentsCount < 3) {
        // 1. 检查是否到底 (THE END)
        const isEndVisible = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el && el.offsetParent !== null; 
        }, END_MARKER_SELECTOR);

        if (isEndVisible) {
            console.log('[Interact] Detected "THE END" marker. Stopping comment scrape.');
            break;
        }

        const commentsData = await extractComments(page, commentsSelector, INCLUDE_REPLIES);
        
        // 过滤新评论
        const newBatch = commentsData.comments.filter(c => {
            const key = `${c.nickname}|${c.content.slice(0, 20)}`;
            if (!seenCommentKeys.has(key)) {
                seenCommentKeys.add(key);
                return true;
            }
            return false;
        });

        if (newBatch.length > 0) {
            console.log(`[Interact] Found ${newBatch.length} new comments. Total: ${allComments.length + newBatch.length}/${MAX_COMMENTS_TARGET}`);
            allComments = allComments.concat(newBatch);
            noNewCommentsCount = 0;

            // --- 即时互动逻辑：回复当前批次中的第一条 ---
            if (config.actions.reply && !hasReplied) {
                const targetComment = newBatch[0];
                console.log(`[Interact] Spotted a target comment from ${targetComment.nickname}, replying now...`);
                
                const noteInfo = {
                    title: detail.title,
                    desc: detail.desc,
                    time: detail.dateText
                };
                const commentInfo = {
                    content: targetComment.content,
                    nickname: targetComment.nickname,
                    time: targetComment.date
                };

                // 决定回复内容
                let finalReplyText = null;
                
                if (config.coze?.enabled) {
                    console.log('[Interact] Generating AI reply via Coze...');
                    
                    // 按照用户要求拼接 Prompt
                    // 格式: 笔记内容: XXX, 评论内容: XXXX
                    const prompt = `笔记内容: ${noteInfo.desc}, 评论内容: ${commentInfo.content}`;
                    
                    console.log(`[Interact] Sending Prompt to Coze: "${prompt}"`);

                    try {
                        // 调用 Coze 接口
                        const aiReply = await cozeClient.chat(prompt);
                        
                        // 严格校验：只有非空、非错才算成功
                        if (aiReply && !aiReply.includes('Error') && !aiReply.includes('（AI 未返回有效内容）')) {
                            finalReplyText = aiReply;
                            console.log(`[Interact] AI Reply Generated: ${finalReplyText}`);
                        } else {
                            // 如果返回为空，通常意味着被 Coze Client 过滤了（例如 false）或者超时
                            console.warn('[Interact] AI decided NOT to reply (returned empty/false). Skipping.');
                        }
                    } catch (e) {
                        console.error(`[Interact] Coze AI failed. Error: ${e.message}. SKIPPING reply action.`);
                    }
                } else {
                    // 如果没开启 AI，则使用默认配置
                    finalReplyText = config.actions.replyText;
                }

                // 只有当有有效回复内容时，才执行回复操作
                if (finalReplyText) {
                    // 执行回复
                    await replyToComment(page, noteInfo, commentInfo, finalReplyText, delay);
                    
                    hasReplied = true;
                    console.log('[Interact] Reply task completed. Stopping comment scrape loop.');
                    
                    // 回复后暂停一会儿，模拟真人操作
                    await delay();
                    
                    break; // 回复完即停止抓取，任务结束
                } else {
                    console.log('[Interact] No valid reply content generated, continuing to next comment...');
                }
            }
            // ----------------------------------------

        } else {
            console.log('[Interact] No new comments found in this scroll...');
            noNewCommentsCount++;
        }

        if (allComments.length >= MAX_COMMENTS_TARGET) break;

        // 滚动操作
        await page.evaluate((sel) => {
            const scroller = document.querySelector(sel);
            if (scroller) {
                scroller.scrollBy({ top: 800, behavior: 'smooth' });
            }
        }, scrollerSelector);
        
        // 等待加载
        await delay();
    }
    
    console.log(`\n[Interact] Summary: Successfully extracted ${allComments.length} parent comments.`);
    
    // 执行互动操作 (基于配置和概率)
    if (config.actions.like) {
      if (shouldPerformAction(config.actions.likeRate)) {
          await doLike(page, delay);
      } else {
          console.log('[Interact] Skipped like action based on probability rate.');
      }
    }

    if (config.actions.collect) {
      if (shouldPerformAction(config.actions.collectRate)) {
          await doCollect(page, delay);
      } else {
          console.log('[Interact] Skipped collect action based on probability rate.');
      }
    }

    if (config.actions.comment) {
      // 逻辑修正：如果开启了 Coze AI 且主要是为了回复评论，
      // 那么不应该再发送默认的 "学到啦" 评论，否则会显得很呆。
      // 仅当 Coze 关闭，或者明确需要双重操作时才执行。
      if (!config.coze?.enabled) {
          await doComment(page, config.actions.commentText, delay);
      } else {
          console.log('[Interact] Coze enabled, skipping default "学到啦" comment action.');
      }
    }

  } catch (err) {
    // 如果是页面关闭导致的错误，重新抛出以便外层捕获并退出
    if (err.message.includes('Target page, context or browser has been closed') || 
        err.message.includes('Browser has been closed')) {
        console.error('[Interact] Page/Browser was closed manually. Rethrowing to stop process...');
        throw err;
    }
    console.error(`[Interact] Error during interaction: ${err.message}`);
  } finally {
    // 强制关闭逻辑：无论如何都要确保这个页面被销毁
    try {
        if (page) {
            console.log('[Interact] Closing detail page...');
            await page.close().catch(() => {}); // 忽略关闭时的任何错误，只要发出了关闭指令就行
        }
    } catch (e) {
        // double insurance
    }
  }
}

/**
 * 提取笔记详情页的核心内容
 * @param {import('playwright').Page} page 
 * @param {string} selector 详情内容容器选择器
 */
async function extractNoteDetail(page, selector) {
  return await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return null;

    // 1. 标题
    const titleEl = container.querySelector('#detail-title');
    const title = titleEl ? titleEl.innerText.trim() : '';

    // 2. 描述与标签
    const descEl = container.querySelector('#detail-desc .note-text');
    let desc = '';
    let tags = [];
    
    if (descEl) {
        // 提取纯文本描述 (移除标签干扰，或者保留)
        // 这里策略是：获取整个文本作为 desc，单独再提取 tags
        desc = descEl.innerText.trim();
        
        // 提取标签
        const tagEls = descEl.querySelectorAll('a.tag');
        tags = Array.from(tagEls).map(el => el.innerText.trim());
    }

    // 3. 日期与地点
    const dateEl = container.querySelector('.bottom-container .date');
    const dateText = dateEl ? dateEl.innerText.trim() : '';
    // dateText 格式通常为 "12-05 甘肃" 或 "昨天 12:00 上海"
    // 简单分离空格
    const parts = dateText.split(' ');
    const date = parts[0] || '';
    const location = parts.length > 1 ? parts[parts.length - 1] : '';

    return {
      title,
      desc,
      tags,
      dateText, // 原始字符串
      date,
      location
    };
  }, selector);
}

/**
 * 提取评论区数据
 * @param {import('playwright').Page} page 
 * @param {string} selector 评论区容器选择器
 * @param {boolean} includeReplies 是否包含二级回复
 */
async function extractComments(page, selector, includeReplies = false) {
  return await page.evaluate(({ sel, withReplies }) => {
    const container = document.querySelector(sel);
    if (!container) return { totalText: 'Not found', comments: [] };

    // 1. 获取评论总数文本
    const totalEl = container.querySelector('.total');
    const totalText = totalEl ? totalEl.innerText.trim() : 'Unknown';

    // 2. 提取评论列表
    // 辅助函数：解析单个 comment-item
    const parseCommentItem = (item) => {
        const getText = (s) => {
            const el = item.querySelector(s);
            return el ? el.innerText.trim() : '';
        };
        const getSrc = (s) => {
            const el = item.querySelector(s);
            return el ? el.getAttribute('src') : null;
        };

        const nickname = getText('.author-wrapper .name');
        const avatar = getSrc('.avatar img, .avatar-item'); // 兼容 img 或 span 背景图
        
        const content = getText('.content .note-text');
        const dateLoc = getText('.info .date'); // "1天前 云南"
        const likes = getText('.info .interactions .like .count');
        
        // 尝试分离日期和地点
        const parts = dateLoc.split(/\s+/);
        const date = parts[0] || '';
        const location = parts.length > 1 ? parts[parts.length - 1] : '';

        return {
            nickname,
            content,
            date,
            location,
            likes,
            avatar
        };
    };

    // 获取所有父评论
    const parentComments = Array.from(container.querySelectorAll('.parent-comment'));
    
    const comments = parentComments.map(parent => {
        // 提取父评论主体
        const mainItem = parent.querySelector('.comment-item');
        if (!mainItem) return null;
        
        const mainData = parseCommentItem(mainItem);

        let replies = [];
        // 仅当开启 includeReplies 时才抓取子评论
        if (withReplies) {
            const subItems = Array.from(parent.querySelectorAll('.reply-container .comment-item'));
            replies = subItems.map(sub => parseCommentItem(sub));
        }

        return {
            ...mainData,
            replies
        };
    }).filter(c => c !== null);

    return {
        totalText,
        comments
    };
  }, { sel: selector, withReplies: includeReplies });
}

/**
 * 执行点赞操作
 * @param {import('playwright').Page} page 
 * @param {Function} delay 延迟函数
 */
async function doLike(page, delay) {
  console.log('[Interact] Liking...');
  const likeSelector = '#noteContainer .interact-container .like-wrapper'; 
  try {
    // 检查是否已点赞 (可选优化: 如果已点赞则跳过)
    const isLiked = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el && el.classList.contains('like-active');
    }, likeSelector);

    if (isLiked) {
        console.log('[Interact] Already liked, skipping.');
        return;
    }

    await page.locator(likeSelector).click({ timeout: 3000 });
    console.log('[Interact] Liked.');
  } catch (e) {
    console.log('[Interact] Like button not found or timeout.');
  }
  await delay();
}

/**
 * 执行收藏操作
 * @param {import('playwright').Page} page 
 * @param {Function} delay 延迟函数
 */
async function doCollect(page, delay) {
  console.log('[Interact] Collecting...');
  const collectSelector = '#noteContainer .interact-container .collect-wrapper';
  try {
    // 检查是否已收藏
    const isCollected = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el && el.classList.contains('collected'); // 假设收藏状态类名为 collected，需确认
    }, collectSelector);

    if (isCollected) {
        console.log('[Interact] Already collected, skipping.');
        return;
    }

    await page.locator(collectSelector).click({ timeout: 3000 });
    console.log('[Interact] Collected.');
  } catch (e) {
    console.log('[Interact] Collect button not found or timeout.');
  }
  await delay();
}

/**
 * 执行评论操作
 * @param {import('playwright').Page} page 
 * @param {string} text 评论内容
 * @param {Function} delay 延迟函数
 */
async function doComment(page, text, delay) {
  console.log(`[Interact] Commenting: "${text}"`);
  const commentInputDiv = '#noteContainer .input-box .content-edit > div > div';
  const submitBtnSelector = '#noteContainer .bottom .right-btn-area button.submit';
  
  try {
    // 1. 点击输入框以聚焦
    await page.locator(commentInputDiv).click({ timeout: 5000 });
    await delay();

    // 2. 输入内容
    await page.keyboard.type(text, { delay: 100 });
    await delay();
    
    // 3. 点击发送按钮
    await page.locator(submitBtnSelector).click({ timeout: 3000 });
    console.log('[Interact] Comment sent.');
    
  } catch (e) {
    console.log(`[Interact] Comment failed: ${e.message}`);
  }
  await delay();
}

/**
 * 回复指定评论（目前默认回复第一条）
 * @param {import('playwright').Page} page 
 * @param {object} noteInfo 笔记信息 {title, desc, time}
 * @param {object} commentInfo 评论信息 {content, nickname, time}
 * @param {string} replyText 回复内容
 * @param {Function} delay 延迟函数
 */
async function replyToComment(page, noteInfo, commentInfo, replyText, delay) {
  console.log('\n[Interact] Prepare to reply to comment:');
  console.log(`Target User: ${commentInfo.nickname}`);
  
  // 1. 定位到目标评论 (通过昵称匹配)
  // 使用 filter 找到包含特定昵称的 parent-comment
  const targetCommentLocator = page.locator('.parent-comment')
      .filter({ has: page.locator('.author-wrapper .name', { hasText: commentInfo.nickname }) })
      .first();
  
  // 2. 找到回复按钮
  const replyBtn = targetCommentLocator.locator('.right .info .interactions .reply').first();

  try {
    // 检查是否找到目标
    if (await targetCommentLocator.count() === 0) {
        throw new Error(`Could not find comment locator for user: ${commentInfo.nickname}`);
    }

    // 确保评论可见
    await targetCommentLocator.scrollIntoViewIfNeeded();
    await delay();

    // 点击回复
    console.log('[Interact] Clicking reply button...');
    await replyBtn.click();
    
    // 等待输入框响应
    const commentInputContainer = '#noteContainer .input-box .content-edit';
    await page.waitForSelector(commentInputContainer);
    await delay();

    // 3. 输入内容
    console.log(`[Interact] Typing reply: "${replyText}"`);
    
    // 点击容器聚焦
    await page.locator(commentInputContainer).click(); 
    await delay(); // 再次等待一小会儿确保 focus
    
    await page.keyboard.type(replyText, { delay: 100 });
    await delay();

    // 4. 发送
    const submitBtnSelector = '#noteContainer .bottom .right-btn-area button.submit';
    await page.locator(submitBtnSelector).click();
    console.log('[Interact] Reply sent.');

  } catch (e) {
    console.log(`[Interact] Reply failed: ${e.message}`);
  }
}
