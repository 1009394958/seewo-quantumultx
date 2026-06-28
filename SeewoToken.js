/*
 * 希沃 Token 获取脚本 — for Quantumult X
 * 
 * 【模式一】script-response-body（主要方式）
 *   捕获登录 API 响应 → 提取 token → 通知用户
 *   配置: url script-response-body https://...
 * 
 * 【模式二】script-request-header（备用）
 *   从请求 Cookie 中提取 x-auth-token
 *   配置: url script-request-header https://...
 * 
 * 【模式三】手动运行
 *   在 QX 脚本编辑器中执行 main() 查看已保存的 token
 * 
 * ====== 重要 ======
 * 所有路径都必须以 $done() 结尾，否则 QX 会挂起。
 */

// ==================== 配置 ====================
const TOKEN_KEY = 'seewo_x_auth_token';
const USER_KEY  = 'seewo_user_info';
const TITLE     = '希沃 Token';

// ==================== 提取函数 ====================

function extractToken(body) {
  try {
    const d = JSON.parse(body);
    return d?.data?.token || null;
  } catch (e) {
    console.log('parse error: ' + e.message);
    return null;
  }
}

function extractUser(body) {
  try {
    const u = JSON.parse(body).data?.user;
    if (!u) return null;
    return { uid: u.uid, nickName: u.nickName, realName: u.realName, accountId: u.accountId, unitId: u.unitId };
  } catch { return null; }
}

function tokenFromCookie(cookie) {
  const m = cookie?.match(/(?:^|;)\s*x-auth-token=([^;]+)/);
  return m ? m[1] : null;
}

// ==================== 处理函数 ====================

/** script-response-body：从登录响应中提取 token */
function onResponse(body) {
  const token = extractToken(body);
  if (token) {
    $prefs.setValueForKey(token, TOKEN_KEY);
    const user = extractUser(body);
    if (user) $prefs.setValueForKey(JSON.stringify(user), USER_KEY);
    $notify(TITLE, '✅ Token 获取成功', token.substring(0, 20) + '...');
    console.log('token saved: ' + token);
  } else {
    $notify(TITLE, '❌ 获取失败', '响应中未找到 token 字段');
  }
  $done({ body });   // ← 必须调用 $done()
}

/** script-request-header：从 Cookie 中提取 token */
function onRequest(headers) {
  const cookie = headers['Cookie'] || headers['cookie'] || '';
  const token = tokenFromCookie(cookie);
  if (token) {
    const old = $prefs.valueForKey(TOKEN_KEY);
    if (old !== token) {
      $prefs.setValueForKey(token, TOKEN_KEY);
      $notify(TITLE, '✅ Token 已刷新', token.substring(0, 20) + '...');
    }
  }
  $done($request);   // ← 必须调用 $done()
}

/** 手动运行：查看已保存的 token */
function onManual() {
  const token = $prefs.valueForKey(TOKEN_KEY);
  if (token) {
    console.log('Token: ' + token);
    $notify(TITLE, '🔑 已保存的 Token', token);
  } else {
    $notify(TITLE, '⚠️ 暂无 Token', '请先打开希沃白板触发登录');
  }
  const userStr = $prefs.valueForKey(USER_KEY);
  if (userStr) {
    try { const u = JSON.parse(userStr); console.log('用户: ' + (u.nickName || u.realName)); } catch {}
  }
  $done();           // ← 必须调用 $done()
}

// ==================== 入口 ====================

if (typeof $response !== 'undefined' && $response) {
  onResponse($response.body);
} else if (typeof $request !== 'undefined' && $request && typeof $response === 'undefined') {
  onRequest($request.headers);
} else {
  onManual();
}
