/*
希沃每日签到 — for Quantumult X
==================================
[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.checkin.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
*/
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
  main().then(function () { $done(); }).catch(function (e) {
    $notify(TITLE + " ❌", "脚本异常", e.message || String(e));
    $done();
  });
})();
function req(method, url, body, headers) {
  return new Promise(function (resolve, reject) {
    var opts = { url: url, method: method, headers: headers || {} };
    if (body) opts.body = JSON.stringify(body);
    $task.fetch(opts).then(
      function (r) { resolve({ status: r.statusCode, body: r.body }); },
      function (e) { reject(e.error || e); }
    );
  });
}
function stepRule(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  return req("POST", SIGN_API + "?actionName=RULE_AWARD_LIST&ts=" + ts(), { _csrf: "" }, h);
}
function stepSign(cookie) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = cookie;
  return req("POST", SIGN_API + "?actionName=SIGN_LOTTERY&ts=" + ts(), { _csrf: "" }, h);
}
function stepCheck(token) {
  var h = JSON.parse(JSON.stringify(CHECK_H));
  h.Cookie = "x-auth-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store";
  return req("GET", LEVEL_API, null, h);
}
async function doSign(cookie, token) {
  var ruleR = await stepRule(cookie);
  var rule;
  try { rule = JSON.parse(ruleR.body); } catch (e) { return { ok: false, msg: "解析签到规则失败" }; }
  if (rule && rule.error_code !== 0) return { ok: false, msg: rule.message || "查询失败" };
  var rec = rule && rule.data && rule.data.signRecord || {};
  if (rec.beenSigned) return { ok: true, done: true, msg: "今日已签到 (连续" + (rec.currentDay || "?") + "天)" };
  var srR = await stepSign(cookie);
  var sr;
  try { sr = JSON.parse(srR.body); } catch (e) { return { ok: false, msg: "解析签到结果失败" }; }
  if (sr && sr.error_code !== 0 && sr.status !== 200) return { ok: false, msg: sr.message || "签到失败" };
  if (!token) return { ok: true, msg: "签到成功" };
  var chR = await stepCheck(token);
  var ch;
  try { ch = JSON.parse(chR.body); } catch (e) { return { ok: true, msg: "签到完成" }; }
  var d = ch && ch.data || {};
  return { ok: true, msg: "签到成功" + (d.experience ? " | 经验:" + d.experience : "") + (d.level ? " | Lv." + d.level : "") };
}
function getCookie() {
  var saved = $prefs.valueForKey("seewo_cookie");
  if (saved) return { cookie: saved, token: null };
  var token = TOKEN || $prefs.valueForKey("seewo_token") || "";
  token = token.trim();
  if (!token) return null;
  var c = "x-auth-token=" + token + "; x-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1";
  return { cookie: c, token: token };
}
async function main() {
  var info = getCookie();
  if (!info) {
    $notify(TITLE + " ❌", "缺少 Token", "请先打开希沃 App 捕获 Token");
    return;
  }
  var m = info.cookie.match(/x-auth-token=([^;]+)/);
  var token = m ? m[1] : info.token || "";
  var r = await doSign(info.cookie, token);
  if (r.ok && r.done) $notify(TITLE + " ✓", r.msg, "");
  else if (r.ok) $notify(TITLE + " ✓", r.msg, "");
  else $notify(TITLE + " ❌", r.msg, "");
}