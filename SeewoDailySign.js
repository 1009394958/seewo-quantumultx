/*
 * 希沃 (Seewo) 每日签到脚本 for Quantumult X
 * 
 * 【功能】
 * 使用已获取的 Token 执行每日签到并获取签到结果
 * 
 * 【前置条件】
 * 1. 先运行 SeewoToken.js 获取并保存 token
 * 2. 本脚本会自动从存储中读取 token 执行签到
 * 
 * 【Quantumult X 配置】
 *   [task_local]
 *   # 每天 9:00 自动签到
 *   0 9 * * * SeewoDailySign.js, tag=希沃每日签到
 *   
 *   # 或手动触发（在脚本编辑器中执行 main 函数）
 *   
 *   [rewrite_local]
 *   # 用于刷新 Cookie（可选）
 *   ^https:\/\/(edu\.seewo\.com|easinote\.seewo\.com) url script-request-header SeewoDailySign.js
 *   
 *   [mitm]
 *   hostname = edu.seewo.com, easinote.seewo.com
 * 
 * 【手动执行】
 * 在 Quantumult X 脚本编辑器中运行 main() 函数
 * 
 * 【签到 API 流程（基于 HAR 分析）】
 * 1. RULE_AWARD_LIST  -> 查询签到奖励规则
 * 2. TODAY_RECORD     -> 查询今日签到记录
 * 3. SIGN_LOTTERY     -> 执行签到抽奖
 * 4. checkSignLottery -> 确认签到状态
 */

// ==================== 配置区域 ====================
const CONFIG = {
  notificationTitle: '希沃签到',
  tokenKey: 'seewo_x_auth_token',
  userInfoKey: 'seewo_user_info',
  cookieKey: 'seewo_request_cookie',

  // 签到 API 基础地址
  signApiBase: 'https://easinote.seewo.com/extend/apis',
  // 签到状态检查 API
  statusApi: 'https://edu.seewo.com/api/v2/user/level?checkSignLottery=1',

  // 默认请求头（从 HAR 中提取）
  defaultHeaders: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Content-Type': 'application/json',
    'Origin': 'https://easinote.seewo.com',
    'Referer': 'https://easinote.seewo.com/extend/app/dailysign',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Connection': 'keep-alive',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ENApp/2.1.52.2 NativeVersion/47 Model/iPhone 15 Pro Max'
  },

  // 签到基础 Cookie 字段（token 会动态拼接）
  baseCookieFields: {
    'x-auth-app': 'EasiNoteIOS',
    'client_channel': 'App%20Store',
    'app_version': '2.1.52.2',
    'os_version': '26.0.1'
  }
};

// ==================== 工具函数 ====================

/**
 * 获取已保存的 Token
 */
function getSavedToken() {
  return $preferences.getItemForKey(CONFIG.tokenKey);
}

/**
 * 获取已保存的用户信息
 */
function getSavedUserInfo() {
  const str = $preferences.getItemForKey(CONFIG.userInfoKey);
  if (str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }
  return null;
}

/**
 * 获取已保存的 Cookie（用于刷新）
 */
function getSavedCookie() {
  return $preferences.getItemForKey(CONFIG.cookieKey) || '';
}

/**
 * 构建完整的 Cookie 字符串
 */
function buildCookie(token) {
  const fields = { ...CONFIG.baseCookieFields, 'x-auth-token': token, 'x-token': token };
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * 生成时间戳
 */
function timestamp() {
  return Date.now().toString();
}

/**
 * 发送 API 请求
 */
function apiRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      url: url,
      method: method || 'GET',
      headers: headers || {},
      body: body || ''
    };
    if (body && typeof body === 'object') {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }
    if (body && typeof body === 'string') {
      options.body = body;
    }
    options.headers['Content-Length'] = (options.body || '').length.toString();

    console.log(`${method} ${url}`);

    $task.fetch(options).then(
      response => {
        console.log('Response: ' + response.statusCode);
        resolve({
          status: response.statusCode,
          body: response.body,
          headers: response.headers
        });
      },
      error => {
        console.log('Request failed: ' + error);
        reject(error);
      }
    );
  });
}

/**
 * 发送通知
 */
function notify(title, subtitle, body) {
  $notification.post(title || CONFIG.notificationTitle, subtitle || '', body || '');
}

// ==================== 签到逻辑 ====================

/**
 * 步骤1: 查询签到奖励规则
 */
async function queryRuleAwardList(token, baseHeaders) {
  const url = `${CONFIG.signApiBase}?actionName=RULE_AWARD_LIST&ts=${timestamp()}`;
  const headers = {
    ...baseHeaders,
    'Cookie': buildCookie(token)
  };
  const res = await apiRequest(url, 'POST', headers, { _csrf: '' });
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    console.log('Rule: ' + JSON.stringify(data.data || data));
    return data;
  }
  return null;
}

/**
 * 步骤2: 查询今日签到记录
 */
async function queryTodayRecord(token, baseHeaders) {
  const url = `${CONFIG.signApiBase}?actionName=TODAY_RECORD&ts=${timestamp()}`;
  const headers = {
    ...baseHeaders,
    'Cookie': buildCookie(token)
  };
  const res = await apiRequest(url, 'POST', headers, { _csrf: '' });
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    console.log('Today: ' + JSON.stringify(data.data || data));
    return data;
  }
  return null;
}

/**
 * 步骤3: 执行签到抽奖
 */
async function signLottery(token, baseHeaders) {
  const url = `${CONFIG.signApiBase}?actionName=SIGN_LOTTERY&ts=${timestamp()}`;
  const headers = {
    ...baseHeaders,
    'Cookie': buildCookie(token)
  };
  const res = await apiRequest(url, 'POST', headers, { _csrf: '' });
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    console.log('Sign result: ' + JSON.stringify(data.data || data));
    return data;
  }
  return null;
}

/**
 * 步骤4: 检查签到状态
 */
async function checkSignStatus(token) {
  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'zh-Hans-CN;q=1, en-CN;q=0.9',
    'X-Crypto-Version': '1',
    'x-auth-refer': 'EnAppIOS',
    'User-Agent': 'EN_iOS/2.1.86 (iPhone; iOS 26.0.1; Scale/3.00)',
    'Cookie': `x-auth-token=${token}; client_channel=App%20Store; x-auth-app=EasiNoteIOS; os_version=26.0.1; app_version=2.1.52.2`,
    'Connection': 'keep-alive'
  };
  const res = await apiRequest(CONFIG.statusApi, 'GET', headers);
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    console.log('Status: ' + JSON.stringify(data.data || data));
    return data;
  }
  return null;
}

/**
 * 完整的签到流程
 */
async function doDailySign(token) {
  console.log('====== 开始签到流程 ======');

  // 步骤1: 查询规则
  console.log('[1/4] 查询签到规则...');
  const ruleData = await queryRuleAwardList(token, CONFIG.defaultHeaders);
  if (!ruleData) {
    return { success: false, step: 1, error: '查询签到规则失败' };
  }
  const signRecord = ruleData.data?.signRecord || {};
  if (signRecord.beenSigned) {
    console.log('今日已签到，跳过执行');
    return { success: true, alreadySigned: true, currentDay: signRecord.currentDay };
  }
  console.log('未签到，当前连续天数: ' + signRecord.currentDay);

  // 步骤2: 查询今日记录
  console.log('[2/4] 查询今日记录...');
  await queryTodayRecord(token, CONFIG.defaultHeaders);

  // 步骤3: 执行签到
  console.log('[3/4] 执行签到抽奖...');
  const signResult = await signLottery(token, CONFIG.defaultHeaders);
  if (!signResult) {
    return { success: false, step: 3, error: '签到抽奖请求失败' };
  }
  if (signResult.status !== 200 && signResult.error_code !== 0) {
    return { success: false, step: 3, error: '签到失败: ' + (signResult.message || '未知错误') };
  }
  console.log('签到抽奖执行成功');

  // 步骤4: 确认状态
  console.log('[4/4] 确认签到状态...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const statusData = await checkSignStatus(token);

  return {
    success: true,
    alreadySigned: false,
    result: signResult.data || signResult,
    status: statusData?.data || null
  };
}

// ==================== 主入口 ====================

/**
 * 主函数 - 执行签到
 */
async function main() {
  console.log('====== 希沃每日签到 ======');

  const token = getSavedToken();
  if (!token) {
    console.log('未找到 Token');
    notify('希沃签到', '失败', '未找到 Token，请先登录获取');
    return;
  }
  console.log('Token: ' + token.substring(0, 20) + '...');

  const userInfo = getSavedUserInfo();
  if (userInfo) {
    console.log('用户: ' + (userInfo.nickName || userInfo.realName || '未知'));
  }

  const result = await doDailySign(token);

  console.log('====== 签到结果 ======');
  if (result.success) {
    if (result.alreadySigned) {
      const day = result.currentDay || '?';
      console.log('今日已签到 (连续第 ' + day + ' 天)');
      notify('希沃签到', '今日已签到 (连续 ' + day + ' 天)', '无需重复签到');
    } else {
      const levelData = result.status;
      if (levelData) {
        const info = [
          '经验值: ' + levelData.experience,
          '等级: ' + levelData.level + ' (' + (levelData.memberSymbol || '') + ')',
          '已签到抽奖: ' + (levelData.beenSignLottery ? '是' : '否')
        ];
        notify('希沃签到', '签到成功！', info.join('\n'));
      } else {
        notify('希沃签到', '签到成功', '执行完成');
      }
    }
  } else {
    console.log('签到失败: ' + (result.error || '未知错误'));
    notify('希沃签到', '签到失败', result.error || '请查看日志');
  }

  console.log('====== 签到流程结束 ======');
}

/**
 * 处理请求（用于被动模式，刷新 Cookie）
 */
function handleRequest() {
  const cookieStr = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  if (cookieStr) {
    const match = cookieStr.match(/(?:^|;)\s*x-auth-token=([^;]+)/);
    if (match) {
      const token = match[1];
      const savedToken = $preferences.getItemForKey(CONFIG.tokenKey);
      if (savedToken !== token) {
        $preferences.setItemForKey(token, CONFIG.tokenKey);
        console.log('Token refreshed');
      }
      $preferences.setItemForKey(cookieStr, CONFIG.cookieKey);
    }
  }
}

// ==================== 入口 ====================

if (typeof $request !== 'undefined' && $request && typeof $response === 'undefined') {
  handleRequest();
} else if (typeof $response !== 'undefined' && $response) {
  $done({ body: $response.body });
} else {
  main().then(() => $done());
}
