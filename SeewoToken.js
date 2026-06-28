/*
 * 希沃 (Seewo) Token 获取脚本 for Quantumult X
 * 
 * 【功能】
 * 1. 方式一：捕获登录 API 响应，自动提取 token 并存储
 * 2. 方式二：从已有请求的 Cookie 中提取 x-auth-token
 * 
 * 【Quantumult X 配置】
 * 方式一（推荐） - 捕获登录响应：
 *   [rewrite_local]
 *   ^https:\/\/edu\.seewo\.com\/app\/api\/v1\/wx\/code\/login url script-response-body SeewoToken.js
 *   
 * 方式二 - 从任意 edu.seewo.com 请求的 Cookie 中提取（备选）：
 *   ^https:\/\/edu\.seewo\.com\/(app\/api\/v1\/wx\/code\/login|api\/v2\/user\/info) url script-response-body SeewoToken.js
 *   
 *   [mitm]
 *   hostname = edu.seewo.com, easinote.seewo.com
 *
 * 【使用方式】
 * - 在 Quantumult X 中启用此脚本后，打开希沃白板触发登录
 * - Token 会自动保存并通过通知展示
 * - 手动在脚本编辑器中运行 main() 函数可查看已保存的 token
 */

// ==================== 配置区域 ====================
const CONFIG = {
  // 通知标题
  notificationTitle: '希沃 Token',
  // Token 存储键名
  tokenKey: 'seewo_x_auth_token',
  // 用户信息存储键名
  userInfoKey: 'seewo_user_info',
};

// ==================== 核心逻辑 ====================

/**
 * 从登录响应中提取 token
 * @param {string} body - 响应体 JSON 字符串
 * @returns {string|null} 提取到的 token
 */
function extractTokenFromLogin(body) {
  try {
    const data = JSON.parse(body);
    if (data && data.data && data.data.token) {
      return data.data.token;
    }
    return null;
  } catch (e) {
    console.log('解析登录响应失败: ' + e.message);
    return null;
  }
}

/**
 * 从登录响应中提取用户信息
 * @param {string} body - 响应体 JSON 字符串
 * @returns {object|null} 用户信息对象
 */
function extractUserInfo(body) {
  try {
    const data = JSON.parse(body);
    if (data && data.data && data.data.user) {
      const user = data.data.user;
      return {
        uid: user.uid || '',
        nickName: user.nickName || '',
        realName: user.realName || '',
        phone: user.phone || '',
        accountId: user.accountId || '',
        photoUrl: user.photoUrl || '',
        unitId: user.unitId || '',
      };
    }
    return null;
  } catch (e) {
    console.log('解析用户信息失败: ' + e.message);
    return null;
  }
}

/**
 * 从 Cookie 字符串中提取 x-auth-token
 * @param {string} cookieStr - Cookie 字符串
 * @returns {string|null} 提取到的 token
 */
function extractTokenFromCookie(cookieStr) {
  if (!cookieStr) return null;
  const match = cookieStr.match(/(?:^|;)\s*x-auth-token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 方式一：Quantumult X 响应拦截 - 从登录 API 响应中提取 token
 */
function handleResponse() {
  console.log('捕获到希沃登录响应');

  const token = extractTokenFromLogin($response.body);
  if (token) {
    $preferences.setItemForKey(token, CONFIG.tokenKey);
    console.log('Token 已获取并保存: ' + token);

    const userInfo = extractUserInfo($response.body);
    if (userInfo) {
      $preferences.setItemForKey(JSON.stringify(userInfo), CONFIG.userInfoKey);
      console.log('用户信息已保存: ' + userInfo.nickName);
    }

    $notification.post(
      CONFIG.notificationTitle,
      'Token 获取成功',
      'Token: ' + token.substring(0, 16) + '...'
    );
  } else {
    console.log('响应中未找到 token');
    $notification.post(
      CONFIG.notificationTitle,
      'Token 获取失败',
      '响应中未找到 token 字段'
    );
  }

  return $response.body;
}

/**
 * 方式二：从请求 Cookie 中提取 token（备选方案）
 */
function handleRequest_cookie() {
  console.log('捕获到希沃请求');

  const cookieStr = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  const token = extractTokenFromCookie(cookieStr);

  if (token) {
    const savedToken = $preferences.getItemForKey(CONFIG.tokenKey);
    if (savedToken !== token) {
      $preferences.setItemForKey(token, CONFIG.tokenKey);
      console.log('Token 已从 Cookie 提取并保存: ' + token);
      $notification.post(
        CONFIG.notificationTitle,
        'Token 获取成功（从 Cookie）',
        'Token: ' + token.substring(0, 16) + '...'
      );
    } else {
      console.log('Token 未变化，跳过: ' + token);
    }
  } else {
    console.log('请求 Cookie 中未找到 x-auth-token');
  }
}

/**
 * 手动运行：查看已保存的 token
 */
function main() {
  const token = $preferences.getItemForKey(CONFIG.tokenKey);
  const userInfoStr = $preferences.getItemForKey(CONFIG.userInfoKey);

  if (token) {
    console.log('希沃 Token: ' + token);
    $notification.post(
      CONFIG.notificationTitle,
      '已保存的 Token',
      token
    );
  } else {
    console.log('尚未获取到希沃 Token');
    $notification.post(
      CONFIG.notificationTitle,
      '暂无 Token',
      '请先打开希沃白板触发登录'
    );
  }

  if (userInfoStr) {
    try {
      const userInfo = JSON.parse(userInfoStr);
      console.log('用户: ' + userInfo.nickName + ' (UID: ' + userInfo.uid + ')');
    } catch (e) {
      console.log('解析用户信息失败');
    }
  }
}

// ==================== 入口 ====================

if (typeof $response !== 'undefined' && $response) {
  handleResponse();
} else if (typeof $request !== 'undefined' && $request) {
  handleRequest_cookie();
} else {
  main();
}
