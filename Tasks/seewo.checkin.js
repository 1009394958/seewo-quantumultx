/*
希沃每日签到 — for Quantumult X
==================================
[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.checkin.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
*/

// ★ 手动填 Token（抓包获取 x-auth-token 的值），留空则从存储读取
const TOKEN = "";

const TITLE = "希沃签到";
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

var LOGS = [];

function log(m) {
  LOGS.push("[" + new Date().toLocaleTimeString() + "] " + m);
}

function ts() { return Date.now().toString(); }

(function () {
  log("=== 签到开始 ===");
  main().then(function () {
    log("=== 签到结束 ===");
    $done();
  }).catch(function (e) {
    log("!! 异常: " + (e.message || String(e)));
    $notify(TITLE + " ❌", "脚本异常", LOGS.join("\n"));
    $done();
  });
})();

function req(method, url, body, headers) {
  return new Promise(function (resolve, reject) {
    var opts = { url: url, method: method, headers: headers || {} };
    if (body) opts.body = JSON.stringify(body);
    log("→ " + method + " " + url.replace(/\?.*$/, ""));
    $task.fetch(opts).then(
      function (r) {
        log("← " + r.statusCode + " (" + (r.body || "").substring(0, 150) + ")");
        resolve({ status: r.statusCode, body: r.body });
      },
      function (e) {
        log("✗ 请求失败: " + (e.error || JSON.stringify(e)));
        reject(e.error || e);
      }
    );
  });
}

function stepRule(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  log("[1/3] 查询签到规则");
  return req("POST", SIGN_API + "?actionName=RULE_AWARD_LIST&ts=" + ts(), { _csrf: "" }, h);
}
function stepSign(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  log("[2/3] 执行签到");
  return req("POST", SIGN_API + "?actionName=SIGN_LOTTERY&ts=" + ts(), { _csrf: "" }, h);
}
function stepCheck(token) {
  var h = JSON.parse(JSON.stringify(CHECK_H));
  h.Cookie = "x-auth-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store";
  log("[3/3] 查询签到详情");
  return req("GET", LEVEL_API, null, h);
}

async function doSign(cookie, token) {
  var ruleR = await stepRule(cookie);
  var rule;
  try { rule = JSON.parse(ruleR.body); } catch (e) { return { ok: false, msg: "解析签到规则失败" }; }
  if (rule.error_code !== 0) return { ok: false, msg: rule.message || "查询失败" };
  var rec = rule.data && rule.data.signRecord || {};
  log("签到记录: " + JSON.stringify(rec));
  if (rec.beenSigned) {
    return { ok: true, done: true, msg: "今日已签到 (连续" + (rec.currentDay || "?") + "天)" };
  }

  var srR = await stepSign(cookie);
  var sr;
  try { sr = JSON.parse(srR.body); } catch (e) { return { ok: false, msg: "解析签到结果失败" }; }
  if (sr.error_code !== 0 && sr.status !== 200) return { ok: false, msg: sr.message || "签到失败" };
  log("签到成功: " + JSON.stringify(sr.data || {}).substring(0, 200));

  if (!token) return { ok: true, msg: "签到成功" };
  var chR = await stepCheck(token);
  var ch;
  try { ch = JSON.parse(chR.body); } catch (e) { return { ok: true, msg: "签到完成，查看日志了解详情" }; }
  var d = ch && ch.data || {};
  log("等级: " + JSON.stringify(d));
  return { ok: true, msg: "签到成功" + (d.experience ? " | 经验:" + d.experience : "") + (d.level ? " | Lv." + d.level : "") };
}

function getCookie() {
  var saved = $prefs.valueForKey("seewo_cookie");
  if (saved) { log("使用保存的完整 Cookie"); return { cookie: saved }; }
  var token = TOKEN || $prefs.valueForKey("seewo_token") || "";
  token = token.trim();
  if (!token) return null;
  log("使用 Token: " + token.substring(0, 20) + "...");
  var c = "x-auth-token=" + token + "; x-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1";
  return { cookie: c };
}

async function main() {
  var info = getCookie();
  if (!info) {
    log("缺少 Token");
    $notify(TITLE + " ❌", "缺少 Token — 请先打开希沃 App 捕获", LOGS.join("\n"));
    return;
  }
  var m = info.cookie.match(/x-auth-token=([^;]+)/);
  var token = m ? m[1] : "";
  var r = await doSign(info.cookie, token);
  log("结果: " + r.msg);
  var title = r.ok ? TITLE + " ✓" : TITLE + " ❌";
  $notify(title, r.msg, LOGS.join("\n"));
}
