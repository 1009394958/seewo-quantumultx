/*
希沃白板 每日签到 for Quantumult X
==================================
【定时签到 - task 模式】
  [task_local]
  0 9 * * * https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js, tag=希沃每日签到, img-url=https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Assets/seewo.png, enabled=true
【自动捕获 Token - rewrite 模式】
  首次使用前，先通过 MITM 自动捕获登录 token：
  1. 在希沃白板 App 中登录一次
  2. Quantumult X 自动拦截请求并提取 token
  3. 之后定时签到就无需再管了
  [rewrite_local]
  ^https://edu\.seewo\.com/app/api/v1/wx/code/login url script-response-body https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js
  ^https://edu\.seewo\.com/.* url script-request-header https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.js
  [mitm]
  hostname = edu.seewo.com, easinote.seewo.com
【手动填 Token】
  如果没有 MITM，可以直接在脚本开头的 SEEWO_TOKEN 变量中填入 token
*/

// ★ 已有 token 直接填这里（从抓包获取 x-auth-token 的值）
const SEEWO_TOKEN = "df4433c4f53a4b5ab750d76d2339e769-0014";

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
  // ============ 模式一：script-response-body - 从登录响应提取 Token ============
  if (typeof $response !== "undefined" && $response) {
    console.log("===== 希沃 Token 捕获 (response) =====