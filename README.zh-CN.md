# ALAXEE SteamHub

**ALAXEE 自主维护的 Steam 汉化与页面增强项目。**

当前阶段先验证不依赖 Millennium / Extendium 的 Steam 页面接入方式。翻译核心、游戏数据和适配器都由本仓库维护；第三方 Steam 框架只保留为备用宿主。

## Windows 用户安装

普通用户不需要安装 Node.js、Python、Java 或其他开发运行环境。

1. 从 GitHub Actions 的 CI 运行页面下载 ALAXEE-SteamHub-Setup-x64.exe。
2. 双击安装包。默认安装到当前 Windows 用户目录，不需要管理员权限。
3. 安装程序会创建开始菜单入口；桌面快捷方式可以在安装时选择。
4. 正常退出 Steam，然后从开始菜单启动 ALAXEE SteamHub。
5. 打开 Steam 商店或社区市场页面，观察右下角 ALAXEE 测试标记。
6. 页面跳转后标记应重新出现。

也提供 Alaxee-SteamHub-Windows-x64.zip 免安装便携包。普通用户优先使用 Setup 安装包。

## 卸载和本地数据清理

可以从 Windows 设置中的“已安装的应用”卸载 ALAXEE SteamHub，也可以从开始菜单进入卸载程序。

卸载时会询问是否同时删除本机的设置、缓存、日志和临时数据：

- 选择“是”：结束 ALAXEE SteamHub 桥接进程，删除程序文件、快捷方式、卸载注册信息，以及本机 ALAXEE SteamHub 数据目录。
- 选择“否”：删除程序和快捷方式，但保留本机数据，方便以后重新安装。

卸载不会删除 Steam 客户端、Steam 游戏、存档或用户账号，也不会删除 Supabase 云端账号和跨设备同步数据。本项目不会创建 Windows 服务、计划任务或修改全局 PATH。

## 开发命令

开发和构建机器需要 Node.js 26.9 或更高版本；普通用户不需要 Node.js。

开发命令：

- npm test
- npm run check
- npm start -- --help

Windows x64 安装包由 CI 构建，并在上传前实际执行安装和卸载检查。

## 当前功能状态

- 已有：独立 Steam CEF/CDP 桥接原型、目标网页筛选、导航后脚本注册、Windows loopback 安全检查。
- 正在实现：Steam 页面真正汉化、游戏 AppID 注册表、TBHIndex 按需查询。
- 尚未验证：用户实际 Steam 客户端启动、商店/市场页面注入和页面导航稳定性。

测试标记只证明脚本成功进入页面，不代表翻译功能已经完成。

## 安全边界

- CDP 调试端口没有身份认证，桥接程序只连接 127.0.0.1 / localhost / ::1。
- Windows 启动器会拒绝非 loopback 监听地址。
- 不添加 -dev，不关闭 CEF 沙箱，不连接远程调试地址。
- 不读取 Steam Cookie、登录令牌、账户信息、库存或存档。
- 不对 TBHIndex 进行批量爬取；后续只对用户当前看到的物品按需查询、限速并缓存。
- 查不到精确中文匹配时保留原文，不猜翻译。

## 设计方向

ARCHITECTURE.md 记录了独立优先的技术选型。长期会拆为独立汉化核心和多个可替换宿主适配层：
- Edge MV3
- Steam Standalone CDP
- 可选 Millennium fallback

Steam 宿主改变时，不应重写翻译核心。
