/*
希沃每日签到 — for Quantumult X
==================================
[task_local]
0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.checkin.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true

依赖：需要先通过 seewo.token.js 捕获 Token 并保存到 $prefs
或在脚本开头的 TOKEN 变量中手动填入 Token
*/

// ★ 手动填 Token（抓包获取 x-auth-token 的值），留空则从存储读取
const TOKEN = "df4433c4f53a4b5ab750d76d2339e769-0014";

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

function buildCookie(token) {
  return "x-auth-token=" + token + "; x-token=" + token + "; x-auth-app=EasiNoteIOS; client_channel=App%20Store; app_version=2.1.52.2; os_version=26.0.1";
}
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

function stepRule(token) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = buildCookie(token);
  return req("POST", SIGN_API + "?actionName=RULE_AWARD_LIST&ts=" + ts(), { _csrf: "" }, h);
}
function stepSign(token) {
  var h = JSON.parse(JSON.stringify(COMMON_H));
  h.Cookie = buildCookie(token);
  return req("POST", SIGN_API + "?actionName=SIGN_LOTTERY&ts=" + ts(), { _csrf: "" }, h);
}
function stepCheck(token) {
  var h = JSON.parse(JSON.stringify(CHECK_H));
  h.Cookie = buildCookie(token);
  return req("GET", LEVEL_API, null, h);
}

async function doSign(token) {
  var ruleR = await stepRule(token);
  var rule;
  try { rule = JSON.parse(ruleR.body); } catch (e) { return { ok: false, msg: "解析签到规则失败" }; }
  if (rule && rule.error_code !== 0) return { ok: false, msg: rule.message || "查询失败" };
  var rec = rule && rule.data && rule.data.signRecord || {};
  if (rec.beenSigned) {
    return { ok: true, done: true, msg: "今日已签到 (连续" + (rec.currentDay || "?") + "天)" };
  }

  var srR = await stepSign(token);
  var sr;
  try { sr = JSON.parse(srR.body); } catch (e) { return { ok: false, msg: "解析签到结果失败" }; }
  if (sr && sr.error_code !== 0 && sr.status !== 200) return { ok: false, msg: sr.message || "签到失败" };

  var chR = await stepCheck(token);
  var ch;
  try { ch = JSON.parse(chR.body); } catch (e) { return { ok: true, msg: "签到完成" }; }
  var d = ch && ch.data || {};
  return {
    ok: true,
    msg: "签到成功" + (d.experience ? " | 经验:" + d.experience : "") + (d.level ? " | Lv." + d.level : "")
  };
}

async function main() {
  var token = TOKEN || $prefs.valueForKey("seewo_token") || "";
  token = token.trim();
  if (!token) {
    $notify(TITLE + " ❌", "缺少 Token", "请先捕获 Token 或在脚本 TOKEN 变量中填入");
    return;
  }

  var r = await doSign(token);
  if (r.ok && r.done) {
    $notify(TITLE + " ✓", r.msg, "");
  } else if (r.ok) {
    $notify(TITLE + " ✓", r.msg, "");
  } else {
    $notify(TITLE + " ❌", r.msg, "");
  }
}
