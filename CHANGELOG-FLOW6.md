# FLOW 06 变更记录

- `src/atelier-motion.js`：动作模板向量独立所有权；修复跨采样污染。
- `assets/ink/characters/*/moves/*.json`：133 份迁移资产中的 151 条手脚轨修复；13 份资产的 69 个物理 hold 键连续化；4 份舞龙炎舞重编源空间转身。直接对照输入源包，共 150 份不同资产记录发生改变。
- 新增 `src/ink/anatomy.js`：软可达范围、源骨架与投影分离、统一人体挂点、手脚矩阵、编辑逆投影。
- 新增 `src/ink/articulation.js`：确定性关节角编译、角度展开、角速率限制、FK 重建及真实关节取消交接。
- 新增 `src/ink/skin-geometry.js`：连续肢体外轮廓、光影带和近侧分段遮挡几何。
- `src/ink/renderer.js`：连续曲面替代分段胶囊；同骨架腰胯／头颈；手／扇共同变换；衣纹标准长度；鞋掌零值；实际骨架叠加；视口内独立 paint server。
- `src/ink/runtime.js`、`motion.js`、`motion-graph.js`：规则／视觉求解分离；真实取消目标与关节速度交接；FX 同源挂点；编辑变化清理缓存。
- `game.js`：真实游戏渲染传入视觉骨架，新角色初始化清除关节交接所有权。
- `forge/app.js`：控制点编辑走同一投影的逆变换。
- 新增 `forge/continuity.js`、`continuity.css`：默认无特效的实时骨架与转身检视；手机布局；暂停与焦点恢复；编辑后更新场景。
- `tools/build_forge.py`：直接装配正式新模块；单文件创作版和玩家版均带完整管线；无战斗函数体字符串注入。
- `src/ink/portable.js`、项目 ID 与入口说明：v6 独立存储与递归独立 HTML 导出。
- 新增 `tests/flow6/`、`tools/check_flow6.py`、原始数据修复清单和双版本无特效对照。

旧版源码片段与冻结原始 HTML 保存在 `legacy/flow5/`。详细接口见 `docs/FLOW6-ENGINE.md`，实际验收见 `TEST-REPORT-FLOW6.md`。
