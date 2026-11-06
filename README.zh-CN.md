# ALAXEE SteamHub

**ALAXEE 自主维护的 Steam 汉化与页面增强项目。**

当前阶段先验证不依赖 Millennium / Extendium 的 Steam 页面接入方式。翻译核心、游戏数据和适配器都由本仓库维护；第三方 Steam 框架只保留为备用宿主。

## 当前版本状态

- 已有：独立 Steam CEF/CDP 桥接原型、目标网页筛选、导航后脚本注册、Windows 启动检查、loopback 安全检查。
- 正在加入：Windows x64 单文件 EXE 分发，Node.js 运行时和页面注入脚本全部嵌入。
- 尚未实现：真正的市场物品汉化、TBHIndex 查询、Steam 代理切换。
- 尚未验证：用户实际 Steam 客户端启动、商店/市场页面注入和页面导航稳定性。

测试标记只证明脚本成功进入页面，不代表翻译功能已经完成。

## Windows 用户安装

普通用户不需要安装 Node.js、Python、Java 或其他开发运行环境。

1. 从 GitHub Actions 的 CI 运行页面下载 \`Alaxee-SteamHub-Windows-x64\` 构建产物。
2. 解压完整 ZIP 文件。不要使用仓库的 Source code ZIP 代替运行包。
3. 正常退出 Steam。
4. 双击 \`Start-Steam-Bridge.bat\`。
5. 打开 Steam 商店或社区市场页面，观察右下角 ALAXEE 测试标记。
6. 页面跳转后标记应重新出现。
7. 使用 Ctrl+C 停止桥接程序；Steam 本身不会被关闭。

如果 Steam 已经通过 \`-cef-enable-debugging\` 启动，可使用 \`Attach-To-Running-Steam.bat\`。

## 开发命令

开发和测试机器仍需 Node.js 22+：

\`\`\`powershell
npm test
npm run check
npm start -- --help
\`\`\`

构建 Windows 独立运行包需要 Node.js 26.9+（只用于 CI/开发构建，不是最终用户依赖）。

## 安全边界

- CDP 调试端口没有身份认证，桥接程序只连接 127.0.0.1 / localhost / ::1。
- Windows 启动器会拒绝非 loopback 监听地址。
- 不添加 \`-dev\`，不关闭 CEF 沙箱，不连接远程调试地址。
- 不读取 Steam Cookie、登录令牌、账户信息、库存或存档。
- 不对 TBHIndex 进行批量爬取；后续只对用户当前看到的物品按需查询、限速并缓存。
- 查不到精确中文匹配时保留原文，不猜翻译。

## 设计方向

\`ARCHITECTURE.md\` 记录了独立优先的技术选型。长期会拆为独立汉化核心和多个可替换宿主适配层：
- Edge MV3
- Steam Standalone CDP
- 可选 Millennium fallback

Steam 宿主改变时，不应重写翻译核心。
