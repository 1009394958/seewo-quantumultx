/*
希沃 Token 捕获 — for Quantumult X
==================================
[rewrite_local]
# 方式1：从登录响应提取
^https://edu\.seewo\.com/app/api/v1/wx/code/login url script-response-body https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.token.js
# 方式2：从请求 Cookie 提取
^https://edu\.seewo\.com/.* url script-request-header https://raw.githubusercontent.com/1009394958/seewo-quantumultx/main/Tasks/seewo.token.js
[mitm]
hostname = edu.seewo.com, easinote.seewo.com
*/

const TOKEN_KEY = "seewo_token";

(function () {
  if (typeof $response !== "undefined" && $response) {
    // 模式一：从登录响应提取 Token
    console.log("===== 希沃 Token(response) =====");
    try {
      var body = typeof $response.body === "string" ? $response.body : JSON.stringify($response.body);
      var d = JSON.parse(body);
      var token = d.data && d.data.token || null;
      if (token) {
        $prefs.setValueForKey(token.trim(), TOKEN_KEY);
        $notify("希沃 Token ✓", "Token 获取成功", token.substring(0, 20) + "...");
      } else {
        $notify("希沃 Token ⚠", "响应中未找到 Token", body.substring(0, 200));
      }
    } catch (e) {
      $notify("希沃 Token ❌", "解析异常", e.message);
    }
    $done({});
    return;
  }

  if (typeof $request !== "undefined" && $request && $request.headers) {
    // 模式二：从请求 Cookie 提取 Token
    var cookie = $request.headers["Cookie"] || $request.headers["cookie"] || "";
    var m = cookie.match(/x-auth-token=([^;]+)/);
    if (m) {
      var old = $prefs.valueForKey(TOKEN_KEY);
      if (old !== m[1]) {
        $prefs.setValueForKey(m[1], TOKEN_KEY);
        $notify("希沃 Token ✓", "Token 已更新", m[1].substring(0, 20) + "...");
      }
    }
    $done({});
    return;
  }

  $done({});
})();