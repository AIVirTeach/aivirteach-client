# 学习页单一完成按钮

V1 和 V2 工作区共用 `LessonCompletionButton`。学习进度、进度条和完成操作按学习语言显示。按钮展示未完成、保存中、已保存或失败重试；已完成时可再次点击取消完成。初次读取已完成课时只显示“本节已学完”，不表示刚发生保存。

进度控制器拥有完成命令及其状态。命令保留课时、完成目标、课程版本和学习轮次。按钮只展示状态、发起完成或重试，不调用 API，也不创建历史快照。

未确认的写入先读取进度。同一版本和轮次已达到目标时才确认成功；否则保留原目标。写入与确认读取均失败时保留上次已确认进度用于课时选择和正文展示，但不将这份旧数据作为本次写入成功的证据。用户重试时先获取当前 revision，再明确重试相同目标。409 不自动重放。课程版本或轮次变化会取消旧命令，其他课时不会显示该命令的反馈。其他客户端改变已保存目标时也会清除旧保存反馈。阅读位置、焦点刷新与完成写入继续由同一控制器串行协调。

学习页不再提供手动快照或 History，删除没有其他调用者的前端历史组件、控制器、展示工具和专用 API 方法。后端代码、已有历史数据、结课及重新开始时的自动归档均未改动。重新开始使用的 `LearningSnapshotCommand` 保留。

完成按钮使用局部样式。它不会继承 neubrutal 主题把所有按钮设为黑底、硬阴影的外观，也不修改其他按钮或主题。

## 已运行检查

- 恢复课时活动后客户端单测 35 个文件、248 项通过。包含控制器 22 项、共享按钮 7 项和真实进度 hook、课时选择及共享控件集成 3 项。覆盖完成、取消、保存期间防重复、响应丢失后确认、保留目标重试、409、课程轮次变化、阅读位置排队、卸载和语言切换。
- 本地 Wrangler runtime types 生成和完整 TypeScript 检查通过。生成文件位于忽略的 `work/`，不进入提交。
- 改动的 TypeScript 文件 ESLint 零错误；V1 页面已有一条 `<img>` 性能提示，未扩大修改范围。`git diff --check` 通过。

日志位于工作区 `../.audit/single-progress-button/`。本次恢复策略修正的最终结果见 `recovery-unit-final.log`、`recovery-types-final.log`、`recovery-lint-final.log`。修正后的生产构建通过，日志 `recovery-build.log`；产物 HTTP 渲染测试 8 项通过，日志 `recovery-rendered-html.log`。

## 浏览器验收

实际运行 Vinext 工作区页面，Chrome 验收旧版中文、新版 neubrutal 中文和英文三组场景。使用受控 HTTP API 响应，不连接生产服务。每组均通过首次进度读取失败后恢复、保存中禁用按钮、服务器确认后显示已保存、取消完成请求与确认读取均失败后重试原目标、响应丢失后读取确认、焦点刷新失败后恢复。新版额外确认切换课时后不显示上一课时保存状态。

每组只有一个完成按钮，没有手动快照或历史入口；记录的完成目标依次为 true、false、false、true，没有快照请求或页面 JavaScript 错误。桌面保存中、成功、失败和窄屏截图位于工作区 `../.audit/single-progress-button/browser-artifacts/`。恢复策略修正后重新运行通过，最终日志为 `recovery-browser-existing.log`，可重跑脚本为 `browser-check.mjs`，使用本机 Chrome 和相邻 server 工作区已有的 Playwright。

## 一轮独立评审后的修复

独立评审使用 gpt-6-astra，发现两处失败恢复入口问题。失败写入清空进度会连带清空课时选择，使重试按钮失去归属；初始或焦点读取失败时，课时尚未就绪会禁用或卸载同步重试。

现保留旧进度用于展示，将 V1 按钮移至课时就绪分支之外，并让同步恢复不依赖课时加载状态。正常完成操作仍要求课时就绪。新增集成测试使用真实 `useCourseLearningSession` 与 `CourseLearningPath`，三种恢复场景在修复前均失败，修复后通过。恢复重启 API 的幂等命令载荷测试，删除一条实现旁白注释。没有新增独立评审轮次。

## 课程更新的恢复策略

2026-10-26 在同一 PR 内修正课程版本变化后的恢复。进度状态以 `none`、`retry-sync`、`reload-course` 替换原始错误字符串。控制器选择恢复动作，按钮只显示本地化状态并调用 `recover(lessonId)`。浏览器整页刷新由 hook 注入，控制器不访问 `window`。

课程已更新时优先要求重新加载课程，清除旧进度、完成命令和排队请求。在该控制器生命周期中，不再发出焦点刷新、阅读或完成请求，也不会被后续网络失败降级为普通同步重试。当前课时的完成失败保留原目标；B 课的同步恢复不能重放 A 课的失败命令。按钮在恢复模式下不声明完成切换的 `aria-pressed` 状态。

新增测试覆盖课程更新调用宿主刷新、后续刷新不降级、取消排队阅读、课程更新优先于完成重试、按课时归属恢复、普通网络恢复和中英文更新提示。定向 32 项通过，完整 246 项通过，完整 TypeScript 和改动文件 ESLint 均通过，没有新增独立评审轮次。后端与数据库未改。

实际页面版本恢复在旧版中文、新版 neubrutal 中文和英文三组浏览器场景通过。将 API 课程从 v1 切到 v2，页面显示“课程已更新，点击更新”；旧控制器收到后续 focus 事件也没有额外进度请求。点击后实际页面导航并重新获取 v2 课程，没有自动重放旧完成命令；用户再点击完成时，请求使用 v2 的 courseVersionId。无快照请求和页面 JavaScript 错误。日志 `recovery-browser-version.log`，可重跑脚本 `browser-version-check.mjs`，截图位于同一 browser-artifacts 目录。普通断网等原三组场景也重新通过。

## 恢复 V1 课时活动

2026-10-26 恢复此前精简进度区域时误删的 V1 课时活动。正文块之后以原有活动 Card 样式展示真实 `lesson.activity.prompt`，标题按学习语言显示“课时活动”或“Lesson activity”。空白活动指令不显示卡片，不添加示例教学内容、额外按钮或 V2 行为。

永久回归测试挂载实际 `WorkspacePage` 的 V1 布局，使用受控 HTTP 课时响应，确认独立于 blocks 的活动指令可见，并保留一个完成按钮。修复前因真实活动文字缺失失败，修复后两项通过，另覆盖空活动不生成指令。完整单测 35 个文件、248 项通过，TypeScript 和改动文件 ESLint 均通过；静态检查仍只有原有 V1 `<img>` 提示。日志为 `activity-red.log`、`activity-focused.log`、`activity-unit-final.log`、`activity-types-final.log`、`activity-lint-final.log`。本次恢复后的构建和产物 HTTP 渲染 8 项通过，日志 `activity-build.log`、`activity-rendered-html.log`。实际 V1 浏览器页面确认正文与独立活动指引同时可见、完成按钮仅一个，并通过保存、取消、原目标失败重试和响应丢失确认。没有快照请求或页面 JavaScript 错误；API 为受控响应。日志 `activity-browser.log`，脚本 `browser-activity-check.mjs`。

## 验证边界

单测使用受控 API transport，浏览器使用受控 HTTP API 响应；两者均不能代替真实数据库、生产 API、虚拟机、Blob 或上线验收。本次没有部署、没有生产数据写入。
