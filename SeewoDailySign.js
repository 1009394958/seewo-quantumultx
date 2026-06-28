/*
 * 希沃每日签到脚本 — for Quantumult X
 *
 * 【功能】
 * 使用已保存的 Token 执行每日签到，查询结果后通知用户。
 *
 * 【定时任务配置】
 *   0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/SeewoDailySign.js, tag=希沃每日签到
 *
 * 【前置条件】
 * 先通过 SeewoToken.js 获取并保存 Token。
 *
 * 【签到流程】
 *   RULE_AWARD_LIST → 是否已签到？
 *     是 → 通知「今日已签到」
 *     否 → TODAY_RECORD → SIGN_LOTTERY → checkSignLottery → 通知结果
 *
 * ====== 重要 ======
 * 所有路径都必须以 $done() 结尾，否则 QX 会挂起。
 */

// ==================== 常量 ====================

const TOKEN_KEY = 'seewo_x_auth_token';
const USER_KEY  = 'seewo_user_info';
const TITLE     = '希沃签到';

const SIGN_API   = 'https://easinote.seewo.com/extend/apis';
const LEVEL_API  = 'https://edu.seewo.com/api/v2/user/level?checkSignLottery=1';

const COMMON_HEADERS = {
  'Accept'           : 'application/json, text/plain, */*',
  'Accept-Language'  : 'zh-CN,zh-Hans;q=0.9',
  'Content-Type'     : 'application/json',
  'Origin'           : 'https://easinote.seewo.com',
  'Referer'          : 'https://easinote.seewo.com/extend/app/dailysign',
  'User-Agent'       : 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ENApp/2.1.52.2 NativeVersion/47 Model/iPhone 15 Pro Max',
};

const CHECK_HEADERS = {
  'Accept'          : '*/*',
  'Accept-Language' : 'zh-Hans-CN;q=1, en-CN;q=0.9',
  'X-Crypto-Version': '1',
  'x-auth-refer'    : 'EnAppIOS',
  'User-Agent'      : 'EN_iOS/2.1.86 (iPhone; iOS 26.0.1; Scale/3.00)',
};

function buildCookie(token) {
  return `x-auth-token=${token}; x-token=${token}; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1`;
}

function ts() { return Date.now().toString(); }

function log(m) { console.log(m); }

// ==================== HTTP 请求 ====================

function req(url, method, headers, body) {
  const opts = { url, method, headers, body: body ? JSON.stringify(body) : '' };
  if (body) opts.headers['Content-Type'] = 'application/json';
  opts.headers['Content-Length'] = opts.body.length.toString();
  return new Promise((resolve, reject) => {
    $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body }), e => reject(e));
  });
}

// ==================== 签到步骤 ====================

async function stepRule(token) {
  const url = `${SIGN_API}?actionName=RULE_AWARD_LIST&ts=${ts()}`;
  const h = { ...COMMON_HEADERS, Cookie: buildCookie(token) };
  const r = await req(url, 'POST', h, { _csrf: '' });
  const d = JSON.parse(r.body);
  log('RULE: ' + JSON.stringify(d.data || d));
  return d;
}

async function stepToday(token) {
  const url = `${SIGN_API}?actionName=TODAY_RECORD&ts=${ts()}`;
  const h = { ...COMMON_HEADERS, Cookie: buildCookie(token) };
  await req(url, 'POST', h, { _csrf: '' });
}

async function stepSign(token) {
  const url = `${SIGN_API}?actionName=SIGN_LOTTERY&ts=${ts()}`;
  const h = { ...COMMON_HEADERS, Cookie: buildCookie(token) };
  const r = await req(url, 'POST', h, { _csrf: '' });
  const d = JSON.parse(r.body);
  log('SIGN: ' + JSON.stringify(d.data || d));
  return d;
}

async function stepCheck(token) {
  const h = { ...CHECK_HEADERS, Cookie: buildCookie(token) };
  const r = await req(LEVEL_API, 'GET', h);
  const d = JSON.parse(r.body);
  log('CHECK: ' + JSON.stringify(d.data || d));
  return d;
}

// ==================== 完整签到流程 ====================

async function doSign(token) {
  log('=== 开始签到 ===');
  const rule = await stepRule(token);
  const rec = rule?.data?.signRecord || {};
  if (rec.beenSigned) {
    log('今日已签到 (连续 ' + rec.currentDay + ' 天)');
    return { ok: true, done: true, day: rec.currentDay };
  }
  log('未签到, 开始执行...');
  await stepToday(token);
  const sr = await stepSign(token);
  if (!sr || (sr.status !== 200 && sr.error_code !== 0)) {
    return { ok: false, error: sr?.message || '签到失败' };
  }
  await new Promise(r => setTimeout(r, 1000));
  const ch = await stepCheck(token);
  const ld = ch?.data || {};
  return {
    ok: true,
    done: false,
    exp: ld.experience,
    level: ld.level,
    badge: ld.memberSymbol,
    lottery: ld.beenSignLottery,
    signDay: ld.signDay,
    userData: ld,
  };
}

// ==================== 通知 ====================

function notifyResult(r, user) {
  if (!r.ok) {
    $notify(TITLE, '❌ 签到失败', r.error || '未知错误');
    return;
  }
  if (r.done) {
    $notify(TITLE, '✅ 今日已签到', '连续 ' + (r.day || '?') + ' 天');
    return;
  }
  const lines = [
    '经验值: ' + (r.exp ?? '?'),
    '等级: ' + (r.level ?? '?') + (r.badge ? ' (' + r.badge + ')' : ''),
    '已签到抽奖: ' + (r.lottery ? '是' : '否'),
  ];
  $notify(TITLE, '✅ 签到成功！', lines.join('\n'));
}

// ==================== 主入口（task 模式）====================

async function main() {
  log('=== 希沃每日签到 ===');
  const token = $prefs.valueForKey(TOKEN_KEY);
  if (!token) {
    log('未找到 Token');
    $notify(TITLE, '❌ 失败', '未找到 Token，请先登录获取');
    return;
  }
  log('Token: ' + token.substring(0, 20) + '...');

  const userStr = $prefs.valueForKey(USER_KEY);
  let user = null;
  if (userStr) { try { user = JSON.parse(userStr); log('用户: ' + (user.nickName || user.realName)); } catch {} }

  const r = await doSign(token);
  log('=== 结果: ' + (r.ok ? '成功' : '失败') + ' ===');
  notifyResult(r, user);
}

// ==================== 被动模式 ====================

function onRequest() {
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  const m = cookie?.match(/(?:^|;)\s*x-auth-token=([^;]+)/);
  if (m) {
    const old = $prefs.valueForKey(TOKEN_KEY);
    if (old !== m[1]) {
      $prefs.setValueForKey(m[1], TOKEN_KEY);
      log('Token 已刷新');
    }
  }
  $done($request);
}

function onResponse() {
  $done({ body: $response.body });
}

// ==================== 入口 ====================

if (typeof $request !== 'undefined' && $request && typeof $response === 'undefined') {
  onRequest();
} else if (typeof $response !== 'undefined' && $response) {
  onResponse();
} else {
  main().then(() => $done()).catch(() => $done());
}
