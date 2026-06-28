/*
 * 希沃白板 签到 + Token 获取 — for Quantumult X
 * 
 * 【功能】
 *   1. script-response-body: 从登录响应提取 Token
 *   2. script-request-header: 从 Cookie 提取 Token
 *   3. task: 每日自动签到
 *
 * 【QuantumultX 配置】
 * [rewrite_local]
 * ^https://edu\.seewo\.com/app/api/v1/wx/code/login url script-response-body https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js
 * 
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
 * 
 * [mitm]
 * hostname = edu.seewo.com, easinote.seewo.com
 */
// ==================== 常量 ====================
const TOKEN_KEY = 'seewo_x_auth_token';
const USER_KEY  = 'seewo_user_info';
const TITLE     = '希沃';
const SIGN_API  = 'https://easinote.seewo.com/extend/apis';
const LEVEL_API = 'https://edu.seewo.com/api/v2/user/level?checkSignLottery=1';
const COMMON_H  = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
  'Content-Type': 'application/json',
  'Origin': 'https://easinote.seewo.com',
  'Referer': 'https://easinote.seewo.com/extend/app/dailysign',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ENApp/2.1.52.2 NativeVersion/47 Model/iPhone 15 Pro Max',
};
const CHECK_H = {
  'Accept': '*/*',
  'Accept-Language': 'zh-Hans-CN;q=1, en-CN;q=0.9',
  'X-Crypto-Version': '1',
  'x-auth-refer': 'EnAppIOS',
  'User-Agent': 'EN_iOS/2.1.86 (iPhone; iOS 26.0.1; Scale/3.00)',
};
function buildCookie(token) {
  return 'x-auth-token=' + token + '; x-token=' + token + '; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1';
}
function ts() { return Date.now().toString(); }
// ==================== HTTP 请求 ====================
function req(url, method, headers, body) {
  var opts = { url: url, method: method || 'GET', headers: headers };
  if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  return new Promise(function (resolve, reject) {
    $task.fetch(opts).then(function (r) { resolve({ status: r.statusCode, body: r.body }); }, function (e) { reject(e); });
  });
}
// ==================== Token 提取 ====================
function extractToken(body) {
  try { var d = JSON.parse(body); return d && d.data && d.data.token || null; }
  catch (e) { console.log('parse error: ' + e.message); return null; }
}
function extractUser(body) {
  try { var u = JSON.parse(body).data.user; return { uid: u.uid, nickName: u.nickName, realName: u.realName }; }
  catch { return null; }
}
function tokenFromCookie(cookie) {
  var m = cookie && cookie.match(/(?:^|;)\s*x-auth-token=([^;]+)/);
  return m ? m[1] : null;
}
// ==================== 签到步骤 ====================
function stepRule(token) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = buildCookie(token);
  return req(SIGN_API + '?actionName=RULE_AWARD_LIST&ts=' + ts(), 'POST', h, { _csrf: '' });
}
function stepSign(token) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = buildCookie(token);
  return req(SIGN_API + '?actionName=SIGN_LOTTERY&ts=' + ts(), 'POST', h, { _csrf: '' });
}
function stepCheck(token) {
  var h = JSON.parse(JSON.stringify(CHECK_H));
  h.Cookie = buildCookie(token);
  return req(LEVEL_API, 'GET', h);
}
// ==================== 签到主逻辑 ====================
async function doSign(token) {
  var ruleR = await stepRule(token);
  var rule;
  try { rule = JSON.parse(ruleR.body); } catch { return { ok: false, msg: '解析签到规则失败' }; }
  var rec = rule && rule.data && rule.data.signRecord || {};
  if (rec.beenSigned) return { ok: true, done: true, day: rec.currentDay, msg: '今日已签到 (连续' + (rec.currentDay || '?') + '天)' };
  var srR = await stepSign(token);
  var sr;
  try { sr = JSON.parse(srR.body); } catch { return { ok: false, msg: '解析签到结果失败' }; }
  if (sr && sr.error_code !== 0 && sr.status !== 200) return { ok: false, msg: sr.message || '签到失败' };
  var chR = await stepCheck(token);
  var ch;
  try { ch = JSON.parse(chR.body); } catch { return { ok: true, msg: '签到完成 (获取详情失败)' }; }
  var d = ch && ch.data || {};
  return {
    ok: true, done: false,
    exp: d.experience, level: d.level, badge: d.memberSymbol,
    day: d.signDay,
    msg: '签到成功' + (d.experience ? ' | 经验: ' + d.experience : '') + (d.level ? ' | Lv.' + d.level : '')
  };
}
// ==================== 响应模式：提取 Token ====================
function onResponse() {
  var body = $response.body;
  var token = extractToken(body);
  if (token) {
    $prefs.setValueForKey(token, TOKEN_KEY);
    var user = extractUser(body);
    if (user) $prefs.setValueForKey(JSON.stringify(user), USER_KEY);
    $notify(TITLE, '✅ Token 获取成功', token.substring(0, 20) + '...');
  } else {
    $notify(TITLE, '❌ 获取失败', '响应中未找到 token');
  }
  $done({ body: body });
}
// ==================== 请求模式：从 Cookie 提取 Token ====================
function onRequest() {
  var cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  var token = tokenFromCookie(cookie);
  if (token) {
    var old = $prefs.valueForKey(TOKEN_KEY);
    if (old !== token) {
      $prefs.setValueForKey(token, TOKEN_KEY);
      $notify(TITLE, '✅ Token 已刷新', token.substring(0, 20) + '...');
    }
  }
  $done($request);
}
// ==================== 定时任务模式：签到 ====================
async function onTask() {
  var token = $prefs.valueForKey(TOKEN_KEY);
  if (!token) {
    $notify(TITLE, '❌ 签到失败', '无 Token，请先登录');
    return;
  }
  var r = await doSign(token);
  if (r.done) $notify(TITLE, '✅ ' + r.msg, '');
  else if (r.ok) $notify(TITLE, '✅ ' + r.msg, r.badge ? '徽章: ' + r.badge : '');
  else $notify(TITLE, '❌ ' + r.msg, '');
}
// ==================== 手动模式 ====================
function onManual() {
  var token = $prefs.valueForKey(TOKEN_KEY);
  if (token) {
    var userStr = $prefs.valueForKey(USER_KEY);
    var name = '';
    if (userStr) { try { var u = JSON.parse(userStr); name = u.nickName || u.realName || ''; } catch {} }
    $notify(TITLE, '🔑 已保存 Token', (name ? name + ' | ' : '') + token.substring(0, 24) + '...');
  } else {
    $notify(TITLE, '⚠️ 无 Token', '请打开希沃白板触发登录');
  }
  $done();
}
// ==================== 入口 ====================
if (typeof $response !== 'undefined' && $response) {
  onResponse();
} else if (typeof $request !== 'undefined' && $request && typeof $response === 'undefined') {
  onRequest();
} else if (typeof $task !== 'undefined') {
  onTask().then(function () { $done(); }).catch(function () { $done(); });
} else {
  onManual();
}
