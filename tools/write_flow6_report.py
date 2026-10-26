#!/usr/bin/env python3
"""Write the delivery report from completed, SHA-bound actual QA records."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json
R=Path(__file__).resolve().parents[1];O=R/'qa/flow6'
def get(name):return json.loads((O/(name+'.json')).read_text(encoding='utf-8'))
sha=hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest()
soak=get('endurance');validation=get('validation');anatomy=get('anatomy');boundary=get('key-boundary-continuity');cancel=get('transition-matrix');sockets=get('socket-matrix');comparison=get('visual-comparison');recovery=get('recovery-observation');checker=get('checker-tests')
assert soak['status']=='passed' and soak['htmlSha256']==sha and soak['elapsedWallSeconds']>=1200
assert validation['status']=='passed' and validation['evidence']['endurance']['fullSoakAccepted']
for name in ['anatomy','regression-core','compatibility','socket-matrix','anatomy-browser','browser','portability','transition-matrix','regression','key-boundary-continuity','visual-comparison','recovery-observation','checker-tests','direct-archive-contracts']:
 assert get(name)['htmlSha256']==sha, 'Stale evidence: '+name
now=datetime.now(timezone.utc);start=datetime(2026,10,4,16,53,tzinfo=timezone.utc);elapsed=(now-start).total_seconds();f=soak['final'];environment=soak['environment'];bone=anatomy['tests'][2]['detail'];r=get('regression')['results']
rows=[]
for name,label in [('anatomy','新骨架／模板／角度合同'),('regression-core','既有动作图／时钟／FX 核心'),('anatomy-browser','新骨架真实浏览器检查'),('browser','编辑／FX／界面兼容检查'),('compatibility','路线／渲染调度矩阵'),('transition-matrix','真实取消关节交接'),('socket-matrix','真实 SVG 扇柄／扇尖挂点'),('portability','独立 HTML 导出／回读')]:
 d=get(name);rows.append(f"| {label} | {d['passed']} / {d['total']} | `qa/flow6/{name}.json` |")
report=f'''# INK FLOW 06 · 连续骨架与动作引擎验收报告

报告生成：{now.isoformat()}（UTC）。

## 1. 交付结论与范围

本版基于用户提供的 **INK-Flow-5-Engine-Source.zip**，已完成正式源码修改、单文件创作版／玩家版构建、真实旧版对照、浏览器回归和当前构建的 20 分钟连续运行。源文件不是上一轮仅有截图的未完成修订，而是从完整 v5 源码恢复后实施。

本回合可核实的工作记录不晚于 **2026-10-04 16:53 UTC**，截至报告时至少约 **{elapsed/60:.1f} 分钟**（包含开发、调试、测试和交付整理）。持续运行是其中的一部分，不能再重复计作额外工作时长。

本次重点是源数据、关节求解和部件连接，不以新增菜单、粒子数量或测试数量代替视觉验收。首页新增骨架检视默认无特效；另附实际分别运行 v5 和 v6 源码的慢放对照。

创作版：`dist/INK-Street-Fighter-6.html`。玩家版：`dist/INK-Street-Fighter-6-Player.html`。源码导览：`README.md`、`CHANGELOG-FLOW6.md`、`docs/FLOW6-ENGINE.md`。

## 2. 已定位并修复的根因

### 2.1 动作模板被采样过程修改

旧 `src/atelier-motion.js` 的 `K()` 是浅拷贝，姿势对象虽然不同，`fw/rw/fa/ra` 仍可能是同一数组。普通技生成逻辑修改数组后，后续采样继续使用被修改的模板，最终把异常值写入动作资产。

修复为独立向量所有权。恢复 **133 份迁移记录的 151 条坐标轨**；没有在构建或用户导入时自动清洗手工动作。舞的 sMK 16F 手腕横坐标约从 −742.469 恢复为 67.005；sHK 22F 约从 −723.273 恢复为 67.193。单纯在最终 IK 裁剪可达距离不能修复轨道中途穿身，因此同时修了生成器和落盘资产。

证据：`asset-repair-journal.json` 保存逐项前后值；核心测试执行 10,000 次独立模板修改验证未污染。

### 2.2 投影后的肘膝被再次重新求解

旧转身分别处理身体与手脚目标，投影缩短后又用原骨长猜肘膝，导致反折和跳位。新 `anatomy.js` 在源空间解算，`articulation.js` 将目标轨编译为连续关节角并按固定骨长重建，再把整条关节链一起投影。手掌／折扇投影完整基底，避免侧面近零前臂被重新归一化成反向角。

转身时腿使用重力轴，脚踝的作者高度不因骨盆局部倾斜轴而被甩动。完整转圈数保留；不存在为了“最短旋转”把 360° 或 720° 擦掉的处理。

### 2.3 胶囊拼接和衣纹初始化不连续

新 `skin-geometry.js`／`renderer.js` 用一条闭合外轮廓贯通每条手臂／腿；光影带与衣纹裁剪共用曲面，避免两段独立带边框胶囊接在一起。肩髋接口和腰胯有同骨架连接面。

护腕、绑腿曾以首次绘制的投影长度建立，先打开哪一帧会改变后续结果。现以固定源骨长建立，再随投影缩放。脚掌的显式 `0°` 保持有效，不再被 `value || fallback` 误判为缺省值。

### 2.4 值连续不等于实际骨架连续

正式 `Runtime.capture()` 从实际游戏接口采样下一招，明确清空旧交接。修复了“下一招没声明 yaw 时借用上一招 yaw，但实际播放又回到中性值”的不一致。

除了目标姿势，还交接实际关节角和角速度；在下一招首有效帧前结束。当前 16 条路线双向的 **{cancel['total']} 次真实取消**，最大关节位置差为 **{cancel['maximumJointDisplacement']:.6g} px**，属于数值舍入量级。零时长交接样本数为 **{cancel['instantaneousHandoffs']}**；未用未测试的零时长情况扩展结论。

### 2.5 不知火舞与特效挂点

4 份龙炎舞重新组织源空间手脚与胸胯／头部转轴，避免目标先翻一次、身体再翻一次。13 份记录中 **69 个值发生变化却使用 hold 的物理键**改为连续插值；不变化的 hold 和折扇状态开关保留。

扇柄、扇尖、手掌、局部特效和世界发射器全部使用最终视觉骨架。v5 的生命周期、距离发射、拖尾、定格和容量管理继续保留并回归，而非再加闪光掩盖关节问题。

直接对照输入的 v5 源包，共 **150 份不同资产记录**发生改变；上述三份修复日志覆盖同一组 150 个路径，详见 `direct-archive-contracts.json`。

## 3. 可直接查看的真实对照

`qa/flow6/v5-v6-motion-comparison.mp4`：**{comparison['frames']} 帧，{comparison['videoSeconds']:.3f} 秒**，含同姿态完整转身、sHK、sMK、龙炎舞。旁边有同名 PNG 逐帧对照图和各取样帧。

左侧载入冻结原 v5 HTML，右侧载入本版构建；镜头、动作时间、显示尺寸一致。关闭特效与附件次级摆动以暴露接缝。对照同时包含引擎和资产修复，不能解读为单个算法的独立收益。录像按确定动作时间采样慢放，不测硬件 FPS。

冻结旧版 SHA-256：`{comparison['baselineSha256']}`。

复现：`python tests/flow6/capture-comparison.py`，需要 Playwright、Chromium、Pillow 和 ffmpeg。旧版 HTML 在 `legacy/flow5/baseline-v5.html`。

## 4. 最终构建的检查结果

| 检查 | 结果 | 原始证据 |
| --- | ---: | --- |
{chr(10).join(rows)}
| 输入源包直接绑定／框配置对照 | 690 / 690 | `direct-archive-contracts.json` |
| 关键帧边界位置检查 | {boundary['checks']:,} 次，失败 {boundary['totalFailures']} | `key-boundary-continuity.json` |
| 原战斗机制 | 39 / 39 | `regression.json` |
| 八角色逐招回放 | 522 / 522 | `regression.json` |
| 旧基础／工坊／Flow 核心 | {r['ink']['passed']}/{r['ink']['total']}、{r['forge']['passed']}/{r['forge']['total']}、{r['flow']['passed']}/{r['flow']['total']} | `regression.json` |
| 验收器反例测试 | {checker['passed']} / {checker['total']} | `checker-tests.json` |

这些计数混合了合同测试、采样矩阵和回放，不能简单相加称为不同用户场景。522 次逐招回放走游戏练习入口，包含入口的前置条件准备，不声称每项都通过自然手工输入完成。真实路线／取消矩阵独立记录自然命中与合法取消。

全库 690 份片段以 1/4F 检查 **{bone['samples']:,} 个样本／{bone['components']:,} 个数值分量**，源骨长度最大误差 **{bone['maxError']:.6g} px**。这是未投影骨长，屏幕侧面缩短不是错误。

关键帧边界在 `t ± {boundary['epsilonFrames']}F` 各取一侧，最大关节位移 **{boundary['maximumDisplacement']:.6f} px**，阈值为 {boundary['thresholdPixels']} px。该结果只覆盖明确的有限采样，不是所有任意编辑／时间点的数学证明。

实际 SVG 扇柄／扇尖核对最大误差 **{sockets['maximumError']:.6f} px**；另有 8 角色 × 12 转角 × 4 手脚端点的 384 次实际变换核对，见 `anatomy-browser.json`。随机拖动、骨架叠加实际可见、首帧无关衣纹、镜像、暂停与焦点恢复均有浏览器断言。

独立导出验证包括完整 HTML 重新打开、第二代导出、玩家版入口隐藏、旧格式导入不擅改用户轨道、非法导入原子性，以及页面不需联网请求。环境限制下测试载入完整字节，原生文件授权不在结论内。

## 5. 当前构建真实 20 分钟连续运行

开始：**{soak['startedAt']}**。结束：**{soak['finishedAt']}**。

实际单调时钟持续 **{soak['elapsedWallSeconds']:.3f} 秒**，完成 **{soak['completedRoutes']} 条真实连段**。同一 Chromium 页面持续渲染，期间切换方向、路线与特效设置，进入新骨架检视、旧引擎检视、演武和工坊，并检查暂停不推进模拟。

记录：{f.get('raf',0):,} 次 rAF，{f.get('inspections',0)} 次检视，{f.get('pausedChecks',0)} 次暂停检查，{f.get('views',0)} 次视图检查。最大世界粒子 {f.get('maxParticles',0)}、拖尾 {f.get('maxTrails',0)}、局部粒子 {f.get('maxLocal',0)}、动作历史 {f.get('maxRoots',0)}、挂点缓存 {f.get('maxCache',0)}。未记录连段失败、未处理脚本错误或容量越界。

实战独立粒子由世界池管理，上述局部粒子与缓存统计只读取战斗角色，不是全体工坊／检视场景的统计；局部字段为零不代表预览中没有粒子。预览重建和预算由浏览器专项检查。

原始 `endurance.json` 含每分钟检查点、每条路线结果、堆内存／DOM 计数与浏览器错误。它记录真实墙钟与单调时间，不通过改写计时器制造 20 分钟。渲染次数不是任意设备的帧率承诺。

## 6. 规则与配置实际保留范围

8 角色、690 份动作／状态记录、16 条路线保留；690 份动作绑定和判定框配置与输入包对照一致。未通过改变伤害数值、启动／持续／恢复时长、额外免费资源或取消规则凑连段。舞的实际扩展路线仍为 14 HIT、3375 伤害。

新视觉关节求解与曲面不直接回写规则 IK。但本轮确实修复基础坐标资产，原有按骨骼定位的攻击／受击几何可以随之变化。因此不声称“基础轨不变”，也不把“判定配置不变”扩展成“与 v5 的逐帧碰撞坐标完全相同”。

## 7. 仍存在的边界

- 当前是 2.5D SVG 骨架与连续曲面，不是完整 3D 人体、物理皮肤或布料碰撞。正背面仍依赖二维美术，对战方向仍按原游戏镜像，不包含独立跨对手转身状态机。关节连上不等于全部动作已达到专业手绘质量。
- 上述取消位置检查不代表全部状态切换零误差。补充观察的 **{recovery['samples']} 次地面动作自然回待机**，最大关节差为 **{recovery['maximumJointDisplacement']:.3f} px**；该观察不计为零误差通过。落地、受击、抓投、极端用户编辑也不能从取消矩阵外推。
- 支撑脚是有界修正；触达上限、淡入／淡出和极端轨道仍可能滑步。角度限速可以抑制跳变，但极端轨道可能因此滞后，不自动生成完美人体动作。
- 本环境原生 `file://` 导航返回 `ERR_BLOCKED_BY_ADMINISTRATOR`，记录在 `file-protocol.json`。因此没有验证用户本机双击权限、系统文件夹授权、持久化授权。手机为视口／触摸模拟，无真机 FPS 保证。
- v6 使用独立存储，不自动覆盖 v5。用户导入是整份招式覆盖，不会自动合并新版动作；旧备份若含污染轨道，导入后相应问题可能回到该招。

## 8. 调试失败和最终证据的区分

保留了早期核心测试错误夹具、首次新骨架浏览器未通过项、旧回归首次中止和相关日志。衣纹初始长度依赖、取消目标缺省 yaw 错误都是在这些检查中发现后实际修复，再重跑最终版本，不把失败记录计为通过。

本容器内存上限为 4 GiB；开发期并行浏览器与已有高内存进程曾造成两次 OOM 终止。减小并发后重跑。持续运行前后 cgroup 原始内存事件记录均在 `endurance.json`；不能把环境中止当作长测通过，也不能把未跑完的旧记录套到新版。

验收器有独立反例测试：旧 SHA、失败计数、缺失报告、缺失长测和“请求 1,200 秒但实际只跑 5 秒”的假长测均会被拒绝。反例只存在临时目录，不进入真实验收文件。另用实际打包快照执行了两项归档反例：修改源码内容与加入越界路径均被交付验证器拒绝，见 `package-tests.json`。

## 9. 构建指纹与源码交付

创作版 SHA-256：`{sha}`。

玩家版 SHA-256：`{validation['playerHtmlSha256']}`。

当前构建冻结记录：`build-freeze.json`。快速检查、挂点、取消、边界、导出、回归和长测均绑定该创作版指纹。最终源码包由 `tools/package_flow6.py` 生成，包含逐文件 `SHA256SUMS.json`；`tools/verify_flow6_package.py` 在新目录重新构建两份 HTML、导出模板和游戏脚本并与包中字节对照。

交付包最终校验结果见包外 **INK-Flow-6-Continuity-Delivery-Check.json**。报告不内嵌自身 ZIP 指纹，避免递归指纹问题；归档的最终哈希以该独立记录为准。

## 10. 建议的验收顺序

打开创作版首页 → 骨架与转身检视，保持特效关闭 → 看 360°、sHK 约 22F、sMK 约 16F → 完整播放龙炎舞 → 看真实 v5/v6 对照 → 再运行舞的 14 HIT 连段。核对变化时先用随附的新资产，再选择性导入旧个人工程。

源码构建：`python tools/build_forge.py`。快速检查：`python tools/check_flow6.py`。真实长测：`python tests/flow6/endurance.py --seconds 1200`。只复核现有证据：`python tools/check_flow6.py --report-only --require-soak`。
'''
(R/'TEST-REPORT-FLOW6.md').write_text(report,encoding='utf-8')
(O/'work-session.json').write_text(json.dumps({'recordedNoLaterThan':start.isoformat(),'reportAt':now.isoformat(),'elapsedFromConservativeMarkerSeconds':round(elapsed,3),'includesTesting':True,'note':'A conservative activity marker from this turn, not a claim of uninterrupted manual typing. Endurance is included, not added twice.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('WROTE REPORT',len(report),'characters;',round(elapsed/60,2),'minutes since conservative work marker')
