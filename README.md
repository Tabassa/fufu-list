# 夫夫清单 1.0.0

供 Android 手机和平板使用的本地四象限清单。界面参考用户提供的原子清单截图，应用独立制作。

## 下载安装

- [直接下载 1.0.0 安卓安装包](https://github.com/Tabassa/fufu-list/releases/download/v1.0.0/fufu-list-1.0.0.apk)
- [查看最新发布版本](https://github.com/Tabassa/fufu-list/releases/latest)

手机或平板下载 APK 后打开安装，也可以先下载到电脑，再通过 QQ 发送至设备。不需要编译源码。

## 界面

<img src="docs/preview.png" alt="夫夫清单四象限界面，展示截止日期和具体时间" width="360">

## 使用

1. 将 `fufu-list-1.0.0.apk` 通过 QQ 发送到手机或平板，下载完整后点击安装。若系统要求授权，允许此次用于打开 APK 的 QQ 或文件管理器安装应用。
2. 打开就是四象限。点击任一象限右上角「＋」新增，该象限自动成为默认优先级。
3. 填写待办文字，可修改优先级；点击「日期」在月历上选择一天，可再设置小时和分钟，然后点「确定」和「保存」。日期与时间直接显示在四象限内。
4. 点击「添加图片」调用系统选择器，可附多张图片。缩略图可点开看大图，支持双指缩放；编辑页可移除附件。
5. 点击事项文字进入全屏编辑页，点击圆圈完成或恢复待办。删除需要再次确认。

无需登录，不含广告；所有界面随安装包提供，不需要联网。任务和图片副本存放在本机应用私有目录。选入的图片会复制保存，后续移动原图不会影响已经保存的附件。

第一版手机和平板分别保存，不自动同步。卸载应用或清除应用数据会删除本地记录。截止日期用于显示和排序，本版未包含系统通知提醒。

安装要求：Android 6.0 及以上，Android System WebView / Chrome 内核 90 及以上。当前 vivo 手机和平板通常已随系统提供该组件；旧版本会显示更新提示。此版本已在 Android 15 模拟器运行验证，尚未连接 vivo 实机测试。

## 构建源码

应用 ID：`com.fufu.todo`，版本：`1.0.0`。Java Activity 承载完全本地的 HTML/CSS/JS 页面，系统文档选择器负责导入图片，`AtomicFile` 保存任务 JSON。不申请网络和广泛相册权限。

使用 Windows PowerShell 7、JDK 17、Android SDK Platform 35 / Build Tools 35.0.0。无需 Gradle 或在线依赖解析。将源码目录与以下 `toolchain` 目录并排放置：

```text
work/
    fufu-list/                 # 克隆或解压后的源码
    build.ps1
  toolchain/
    jdk/bin/java.exe
    sdk/platforms/android-35/android.jar
    sdk/build-tools/35.0.0/
```

在源码目录运行 `./build.ps1`，生成 `build/fufu-list-1.0.0.apk`。第一次构建会在同级 `fufu-signing` 目录生成本地签名密钥。仓库不包含私钥、Android SDK、JDK 或用户数据。重新生成的密钥与 Releases 中 APK 的签名不同；覆盖升级须继续使用原签名密钥。

核心测试：`node --test tests/core.test.js`。

浏览器检查需要安装 Playwright 并可运行 Edge。先在源码目录执行 `python -m http.server 8766 --bind 127.0.0.1 --directory assets`，再执行 `node tests/browser-check.js` 和 `node tests/lifecycle-check.js`。

## 开源来源

任务增删改和筛选基础参考并改编自 [OmerShubi/priority-matrix](https://github.com/OmerShubi/priority-matrix)，MIT 许可。中文界面、月历、图片附件、Android 封装和本地保存为此次新增实现。上游来源和完整许可保留在 `LICENSE` 与 `assets/THIRD_PARTY_NOTICES.txt`，后者也随 APK 打包。

验证记录见 `VALIDATION.md`。
