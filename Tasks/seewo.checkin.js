/*
希沃每日签到 — for Quantumult X
==================================
[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.checkin.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
*/

// ★ 手动填 Token（抓包获取 x-auth-token 的值），留空则从存储读取
const TOKEN = "";

const TITLE = "希沃";
const SIGN_API = "https://easinote.seewo.com/extend/apis";
const LEVEL_API = "https://edu.seewo.com/api/v2/user/level?checkSignLottery=1";

const COMMON_H = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh-Hans;q=0.9",
  "Content-Type": "application/json",
  "Origin": "https://easinote.seewo.com",
  "Referer": "https://easinote.seewo.com/extend/app/dailysign",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ENApp/2.1.52.2 NativeVersion/47 Model/iPhone 15 Pro Max",
};
const CHECK_H = {
  "Accept": "*/*",
  "Accept-Language": "zh-Hans-CN;q=1, en-CN;q=0.9",
  "X-Crypto-Version": "1",
  "x-auth-refer": "EnAppIOS",
  "User-Agent": "EN_iOS/2.1.86 (iPhone; iOS 26.0.1; Scale/3.00)",
};

function ts() { return Date.now().toString(); }

(function () {
  console.log("===== 希沃签到开始 =====");
  console.log("时间: " + new Date().toLocaleString());
  main().then(function () {
    console.log("===== 希沃签到结束 =====");
    $done();
  }).catch(function (e) {
    console.log("===== 希沃脚本异常 =====");
    console.log("错误: " + (e.message || String(e)));
    $notify(TITLE + " ❌", "脚本异常", e.message || String(e));
    $done();
  });
})();

function req(method, url, body, headers) {
  return new Promise(function (resolve, reject) {
    var opts = { url: url, method: method, headers: headers || {} };
    if (body) opts.body = JSON.stringify(body);
    console.log("请求: " + method + " " + url);
    console.log("    Headers: " + JSON.stringify(Object.keys(headers || {})));
    if (body) console.log("    Body: " + JSON.stringify(body));
    $task.fetch(opts).then(
      function (r) {
        console.log("响应: " + r.statusCode + " (" + (r.body || "").substring(0, 200) + ")");
        resolve({ status: r.statusCode, body: r.body });
      },
      function (e) {
        console.log("请求失败: " + (e.error || JSON.stringify(e)));
        reject(e.error || e);
      }
    );
  });
}

function stepRule(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  console.log("[步骤1] 查询签到规则 -> RULE_AWARD_LIST");
  return req("POST", SIGN_API + "?actionName=RULE_AWARD_LIST&ts=" + ts(), { _csrf: "" }, h);
}
function stepSign(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  console.log("[步骤2] 执行签到 -> SIGN_LOTTERY");
  return req("POST", SIGN_API + "?actionName=SIGN_LOTTERY&ts=" + ts(), { _csrf: "" }, h);
}
function stepCheck(token) {
  var h = JSON.parse(JSON.stringify(CHECK_H));
  h.Cookie = "x-auth-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store";
  console.log("[步骤3] 查签到详情 -> level?checkSignLottery=1");
  return req("GET", LEVEL_API, null, h);
}

async function doSign(cookie, token) {
  console.log("--- 步骤1/3: 查询签到规则 ---");
  var ruleR = await stepRule(cookie);
  var rule;
  try {
    rule = JSON.parse(ruleR.body);
    console.log("RULE_AWARD_LIST 响应: " + JSON.stringify(rule).substring(0, 500));
  } catch (e) {
    console.log("解析失败: " + e.message + " | 原始: " + (ruleR.body || "").substring(0, 200));
    return { ok: false, msg: "解析签到规则失败" };
  }
  if (rule.error_code !== 0) {
    console.log("查询失败: " + (rule.message || "未知错误"));
    return { ok: false, msg: rule.message || "查询失败" };
  }
  var rec = rule.data && rule.data.signRecord || {};
  console.log("签到记录: " + JSON.stringify(rec));
  if (rec.beenSigned) {
    console.log("今日已签到, 连续 " + (rec.currentDay || "?") + " 天");
    return { ok: true, done: true, msg: "今日已签到 (连续" + (rec.currentDay || "?") + "天)" };
  }

  console.log("--- 步骤2/3: 执行签到 ---");
  var srR = await stepSign(cookie);
  var sr;
  try {
    sr = JSON.parse(srR.body);
    console.log("SIGN_LOTTERY 响应: " + JSON.stringify(sr).substring(0, 500));
  } catch (e) {
    console.log("解析失败: " + e.message + " | 原始: " + (srR.body || "").substring(0, 200));
    return { ok: false, msg: "解析签到结果失败" };
  }
  if (sr.error_code !== 0 && sr.status !== 200) {
    console.log("签到失败: " + (sr.message || "未知错误"));
    return { ok: false, msg: sr.message || "签到失败" };
  }
  console.log("签到成功! data: " + JSON.stringify(sr.data || {}).substring(0, 300));

  if (!token) {
    console.log("无 token, 跳过详情查询");
    return { ok: true, msg: "签到成功" };
  }
  console.log("--- 步骤3/3: 查询签到详情 ---");
  var chR = await stepCheck(token);
  var ch;
  try {
    ch = JSON.parse(chR.body);
    console.log("签到详情响应: " + JSON.stringify(ch).substring(0, 500));
  } catch (e) {
    console.log("详情解析失败, 但签到已完成");
    return { ok: true, msg: "签到完成" };
  }
  var d = ch && ch.data || {};
  console.log("等级数据: " + JSON.stringify(d).substring(0, 200));
  var msg = "签到成功" + (d.experience ? " | 经验:" + d.experience : "") + (d.level ? " | Lv." + d.level : "");
  return { ok: true, msg: msg };
}

function getCookie() {
  console.log("--- 获取 Cookie ---");
  var saved = $prefs.valueForKey("seewo_cookie");
  if (saved) {
    console.log("使用保存的完整 Cookie (含 WAF token)");
    console.log("Cookie: " + saved.substring(0, 100) + "...");
    return { cookie: saved, isFull: true };
  }
  var token = TOKEN || $prefs.valueForKey("seewo_token") || "";
  token = token.trim();
  if (!token) {
    console.log("未找到 Token");
    return null;
  }
  console.log("使用 Token: " + token.substring(0, 20) + "...");
  var c = "x-auth-token=" + token + "; x-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1";
  return { cookie: c, isFull: false, token: token };
}

async function main() {
  var info = getCookie();
  if (!info) {
    console.log("缺少 Token, 无法签到");
    $notify(TITLE + " ❌", "缺少 Token", "请先打开希沃 App 捕获 Token");
    return;
  }

  var m = info.cookie.match(/x-auth-token=([^;]+)/);
  var token = m ? m[1] : info.token || "";
  console.log("提取 token: " + (token ? token.substring(0, 20) + "..." : "无"));

  var r = await doSign(info.cookie, token);
  console.log("签到结果: " + JSON.stringify(r));
  if (r.ok && r.done) $notify(TITLE + " ✓", r.msg, "");
  else if (r.ok) $notify(TITLE + " ✓", r.msg, "");
  else $notify(TITLE + " ❌", r.msg, "");
}