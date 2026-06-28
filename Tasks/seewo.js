/*
希沃白板 每日签到 for Quantumult X
==================================
【定时签到 - task 模式】
  [task_local]
  0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
【自动捕获 Token - rewrite 模式】
  首次使用前，先通过 MITM 自动捕获登录 token：
  1. 在希沃白板 App 中登录一次
  2. Quantumult X 自动拦截登录响应并提取 token
  3. 之后定时签到就无需再管了
  [rewrite_local]
  ^https://edu\.seewo\.com/app/api/v1/wx/code/login url script-response-body https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js
  [mitm]
  hostname = edu.seewo.com, easinote.seewo.com
【手动填 Token】
  如果没有 MITM，可以直接在脚本开头的 SEEWO_TOKEN 变量中填入 token
*/

// ★ 已有 token 直接填这里（从抓包获取 x-auth-token 的值）
const SEEWO_TOKEN = "";

// ==================== 常量 ====================
const TOKEN_KEY = "seewo_token";
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

// ==================== 入口 ====================
(function () {
  // ============ 模式一：Rewrite 模式 - 自动捕获 Token ============
  if (typeof $response !== "undefined" && $response) {
    console.log("===== 希沃 Token 捕获 =====");
    try {
      const rawBody = typeof $response.body === "string" ? $response.body : JSON.stringify($response.body);
      console.log("原始响应: " + rawBody.substring(0, 300));
      const body = JSON.parse(rawBody);
      const token = body.data && body.data.token || null;
      if (token) {
        $prefs.setValueForKey(token.trim(), TOKEN_KEY);
        console.log("✓ Token 已保存: " + token.substring(0, 20) + "...");
        $notify("希沃 Token 捕获 ✓", "Token 获取成功", "已自动保存，可执行每日签到");
      } else {
        console.log("ℹ 未识别到 Token，完整响应: " + rawBody.substring(0, 500));
        $notify("希沃 Token 捕获 ⚠", "响应格式未识别", "请手动从抓包获取 Token");
      }
    } catch (e) {
      console.log("✗ 解析失败: " + e.message);
      $notify("希沃 Token 捕获 ❌", "解析失败", e.message);
    }
    $done({});
    return;
  }
  // ============ 模式二：Task 模式 - 执行签到 ============
  main().then(function () { $done(); }).catch(function (e) {
    console.log("脚本异常: " + (e.message || e));
    $notify("希沃签到 ❌", "脚本异常", e.message || String(e));
    $done();
  });
})();

// ==================== HTTP 请求 ====================
function req(method, url, body, headers) {
  return new Promise(function (resolve, reject) {
    var opts = { url: url, method: method || "GET", headers: headers || {} };
    if (body) { opts.body = JSON.stringify(body); }
    if (typeof $task !== "undefined" && $task.fetch) {
      $task.fetch(opts).then(
        function (r) { resolve({ status: r.statusCode, body: r.body, headers: r.headers }); },
        function (e) { reject(e.error || e); }
      );
    } else if (typeof $httpClient !== "undefined") {
      var cb = function (error, resp, data) {
        if (error) { reject(error); return; }
        resolve({ status: resp.status, body: data, headers: resp.headers });
      };
      if (method === "GET") $httpClient.get(opts, cb);
      else $httpClient.post(opts, cb);
    } else {
      reject("无法找到网络请求 API");
    }
  });
}

// ==================== 签到步骤 ====================
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

// ==================== 签到主逻辑 ====================
async function doSign(token) {
  // 第一步：查询签到规则（判断是否已签到）
  var ruleR = await stepRule(token);
  var rule;
  try { rule = JSON.parse(ruleR.body); } catch (e) { return { ok: false, msg: "解析签到规则失败: " + e.message }; }
  if (rule && rule.error_code !== 0) return { ok: false, msg: rule.message || "查询签到规则失败" };
  var rec = rule && rule.data && rule.data.signRecord || {};
  if (rec.beenSigned) {
    return { ok: true, done: true, day: rec.currentDay, msg: "今日已签到 (连续" + (rec.currentDay || "?") + "天)" };
  }

  // 第二步：执行签到
  var srR = await stepSign(token);
  var sr;
  try { sr = JSON.parse(srR.body); } catch (e) { return { ok: false, msg: "解析签到结果失败: " + e.message }; }
  if (sr && sr.error_code !== 0 && sr.status !== 200) return { ok: false, msg: sr.message || "签到失败" };

  // 第三步：获取签到详情
  var chR = await stepCheck(token);
  var ch;
  try { ch = JSON.parse(chR.body); } catch (e) { return { ok: true, msg: "签到完成 (获取详情失败)" }; }
  var d = ch && ch.data || {};
  return {
    ok: true, done: false,
    exp: d.experience, level: d.level, badge: d.memberSymbol,
    day: d.signDay,
    msg: "签到成功" + (d.experience ? " | 经验: " + d.experience : "") + (d.level ? " | Lv." + d.level : "")
  };
}

// ==================== 获取 Token ====================
function getToken() {
  // 1. 优先用脚本参数传入的 token
  if (typeof $argument !== "undefined" && $argument) {
    try {
      var args = {};
      $argument.split("&").forEach(function (pair) {
        var kv = pair.split("=");
        args[kv[0]] = kv[1];
      });
      if (args.token) return args.token.trim();
    } catch (e) {}
  }
  // 2. 从存储中读取
  var saved = $prefs.valueForKey(TOKEN_KEY);
  if (saved) return saved.trim();
  // 3. 从脚本变量读取
  if (SEEWO_TOKEN) return SEEWO_TOKEN.trim();
  return null;
}

// ==================== Task 入口 ====================
async function main() {
  console.log("===== 希沃签到 for Quantumult X =====");
  var token = getToken();
  if (!token) {
    var msg = "未获取到 Token，请先打开希沃白板 App 登录一次\n"
      + "或在脚本开头的 SEEWO_TOKEN 变量中手动填入 Token";
    console.log("✗ " + msg);
    $notify("希沃签到 ❌", "缺少 Token", msg);
    return;
  }
  console.log("ℹ Token: " + token.substring(0, 16) + "...");
  var r = await doSign(token);
  console.log("ℹ 结果: " + r.msg);
  if (r.ok && r.done) {
    $notify("希沃签到 ✓", r.msg, "");
  } else if (r.ok) {
    $notify("希沃签到 ✓", r.msg, r.badge ? "徽章: " + r.badge : "");
  } else {
    $notify("希沃签到 ❌", r.msg, "");
  }
}
