#!/usr/bin/env python3
"""Generate the Chinese release report from completed, hash-bound evidence.
Refuses to turn a short/candidate run into a final long-run claim.
"""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'qa/flow8'
def load(n):return json.loads((O/(n+'.json')).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 e=load('endurance');s=load('replay-stress');h=sha(R/'dist/INK-Street-Fighter-6.html')
 assert e['status']=='passed' and e['elapsedWallSeconds']>=1500 and e['htmlSha256']==h
 assert s['status']=='passed' and s['elapsedWallSeconds']>=180 and s['htmlSha256']==h
 p=subprocess.run([sys.executable,'tools/check_flow8.py','--evidence','--require-soak'],cwd=R,capture_output=True,text=True)
 (O/'final-evidence-check.log').write_text(p.stdout+p.stderr)
 if p.returncode:raise SystemExit(p.stdout+p.stderr)
 v=load('validation');b=load('browser-contracts');u=load('ui');a=load('portability');m=load('state-matrix');c=load('comparison');d=load('source-diff')
 now=datetime.datetime.now(datetime.timezone.utc);session_path=O/'work-session.json'
 if session_path.exists():
  # Re-generating a report must not pretend that the original session kept running.
  session=json.loads(session_path.read_text());started=datetime.datetime.fromisoformat(session['startedAt']);elapsed=session['elapsedWallSeconds'];session_end=session['reportCompletedAt']
 else:
  started=datetime.datetime.fromisoformat('2026-10-05T06:32:46+00:00');elapsed=(now-started).total_seconds();session_end=now.isoformat()
  assert 3600<=elapsed<86400,'Initial release work session must be captured on its actual day, after the requested hour.'
  session={'kind':'flow8-current-turn-work-session','startedAt':started.isoformat(),'reportCompletedAt':session_end,'elapsedWallSeconds':round(elapsed,3),'method':'UTC wall-clock observations from the current tool session; includes coding, debugging, review, documentation and actively inspected real-browser endurance/stress. Not a claim that every second was CPU execution.','finalHtmlSha256':h,'enduranceElapsedWallSeconds':e['elapsedWallSeconds'],'replayStressElapsedWallSeconds':s['elapsedWallSeconds']}
  session_path.write_text(json.dumps(session,ensure_ascii=False,indent=2)+'\n')
 f=e['final'];sf=s['final'];base=load('baseline-observations');cand=load('candidate-observations');old={x['name']:x for x in base['observations']};new={x['name']:x for x in cand['observations']}
 sample_rows='\n'.join('| '+name+' | '+str(old[k]['distinctPoseSamples'])+' | '+str(new[k]['distinctPoseSamples'])+' |' for k,name in [('walk','行走'),('jump-apex','腾空顶点附近'),('land','落地'),('jump-rise-hold','设计为保持姿态的起跳段')])
 command_evidence=load('final-regressions');gc=[x['heap']['usedSize'] for x in e['checkpoints']];gc.append(e['finalHeap']['usedSize']);sgc=[x['heap']['usedSize'] for x in s['checkpoints']];sgc.append(s['afterGC']['heap']['usedSize'])
 text=f'''# FLOW 08 · 动作响应与实战姿态回放 — 实际验收报告

报告生成：{now.isoformat()}。输入是用户提供的原始 FLOW 07，未访问远端仓库、未提交或推送。原始发布工作从 {started.isoformat()} 起，到记录结束 {session_end} 实际经过 {elapsed/60:.2f} 分钟；该时间包括开发、排查、浏览器检查、报告整理和持续运行，不等于纯 CPU 运算时间。最终打包校验另见 ZIP 外的交付记录。

## 1. 本轮判断与交付

主要不足不是预制招式数量，而是“战斗逻辑已走到下一步，身体与附件却仍按整数步取样”，以及特殊状态和旧特效旁路没有纳入统一时钟。本版修复真实运行路径，新增可复查的实战姿态记录。不是将旧版本改名，也不只是添加展示面板。

主游戏源 `game.js` 接入四个正式模块：`presentation-clock.js`、`state-transitions.js`、`scene-feedback.js`、`pose-replay.js`。`forge/response.js` 为这些运行能力提供 UI；构建器直接拼装正式源码，没有重新引入函数体字符串替换。

逐行补丁 `CHANGESET-FLOW8-ENGINE.patch` 覆盖 {d['changedFiles']} 个引擎、渲染、UI、构建、版本和当前文档文件；测试脚本、证据、媒体和历史归档不属于该补丁的范围。该补丁已在临时目录反向还原到原始 v7，然后正向重新应用，双向文件 SHA-256 均一致。该数目不代表 ZIP 内全部变化文件数。

707 份既有动作／模型／骨架／路线 JSON 与原包逐字节一致：690 份动作、8 份模型、8 份骨架，以及含 22 条路线的一份连段表。没有改伤害、判定、起手／有效／收招时长、硬直和资源要求；v7 的连段编排、有限取消、节奏和 G 键练习全部保留。本轮没有新编制一批连段。

## 2. 可复现的旧版缺陷与修复

### 2.1 行走、跳跃、落地和投射物的显示时间

原版 v7 与新版分别运行其完整 HTML，在同一个已完成的模拟步内依次取 alpha=0.1／0.3／0.5／0.7／0.9，比较实际姿态输出：

| 场景 | v7 不同姿态数量 | v8 不同姿态数量 |
|---|---:|---:|
{sample_rows}

这里的 1→5 只证明所选运动通道开始参与小数帧求值，**不是“帧率提高五倍”，更不是官方游戏的速度对照**。起跳中有意保持的段落仍应保持，不应为了统计数字让它乱动。

模拟侧现在保存上一步状态、姿态时钟和运动速度。身体、发辫／衣带、投射物的位置及扇形弹体旋转使用一致的 alpha；渲染调用不会改变战斗坐标或关节状态。接触定格、暂停、跨状态和投技耦合不强行套普通移动插值。

证据：`qa/flow8/baseline-observations.json`、`candidate-observations.json`、`browser-contracts.json`。

### 2.2 普通收招之外的状态衔接

新增行走／停步、起跳、落地、受击、防御、倒地和起身的表现交接。交接使用模拟求值的姿态与速度，不依赖上一张恰好渲染出来的 `f.pose`。按状态采用 2–8 个可行动作帧，不能借此改变实际攻击规则。

在固定的 **Ryu 防守方 idle→hit 状态切换夹具** 中，最大瞬时关节位移由原版约 {old['idle-to-hit']['maximumImmediateSocketChange']:.2f} 降至本版约 {new['idle-to-hit']['maximumImmediateSocketChange']:.2f} 个角色局部 SVG 单位。夹具直接触发状态，是定位跳变的回归检查，**不是一场真实命中的统计，不代表所有角色、招式都改善同样比例**。受击躯干故意立即反应，手臂和武器短时接续；因此没有将所有受击位移压到零，也没有宣称所有状态严格 C0/C1 连续。

真实扫腿→倒地→起身另由实际 `cHK` 命中运行记录，未人为补命中。倒地起始姿势不再读取可能滞后的绘制缓存。

### 2.3 着地的质量感与不知火舞附件

按真实着地竖直速度加入有界压缩和附件阻尼响应：身体表现压缩上限 7 个角色局部单位，附件响应最多 22 个可行动作帧。舞的发辫、腰带随落地反馈，但不增加落地硬直；下一招起手会承接并清理这些表现，避免把上一跳的回弹重复叠进攻击。回放倒拖和同帧重复求值可恢复一致的附件姿态。清爽模式压低额外响应。

### 2.4 真身体残影、场景池和冻结镜头

原 v7 关闭特效后，倒地冲击仍生成 {old['ground-impact-with-FX-off']['legacyFxCount']} 个旧场景效果；新版同检查为 {new['ground-impact-with-FX-off']['legacyFxCount']}。原残影还从不再完整更新的旧部件 SVG 克隆，造成头、腿等影子游离；现在由真实已解算人物、衣着、附件及折扇生成，并复用最多 6 个渲染器。

地面冲击进入既有 320 容量的统一世界效果池。关闭特效立即隐藏残影，清爽模式不生成新残影。作为攻击实体的投射物本体不会被装饰特效开关关闭，以免影响可读性。镜头震动使用世界特效时钟、幅度有界，暂停／命中定格时保持；不再让画面停住而镜头按现实时间继续晃动。

同条件对照视频 `qa/flow8/flow8-comparison.mp4` 共 {c['frames']} 帧、{c['fps']} fps、{c['durationSeconds']:.3f} 秒，独立运行原始 v7 和最终 v8，固定同一镜头，展示行走、跳跃落地、真实扫腿与 OD 冲刺。各片段标注 0.25×／0.5× 慢放，是用于看差别的演示，不是硬件帧率测试；随机装饰粒子不承诺逐颗相同。

## 3. 给爱好者的实战姿态回放

首页打开「实战动作回放」，或者对战中点「录制实战姿态」。显式开始才录，最多保留最近 600 个真实模拟步和 240 个事件；按 1×、60 Hz 名义约 10 秒，包含命中定格。发生重置时停止录制但保留上一段有用记录，不始终驻留录制开销。

保存内容包括实际解算关节角、两位角色的世界位置／方向、身体通道、发辫／腰带等附件、当时模型／骨架、状态与接触书签。回放既不调用伤害计算，也不推进原对战时钟。支持逐帧、小数帧、倒拖、事件定位、骨架叠加、JSON 导出和导入。

导入为严格 schema：两角色固定身份、单调步号、数值范围与必要通道验证、原型污染键拒绝、8 MB 文件上限。无效数据在验证通过之前不能替换原记录。导入文本作为文本处理，不插入 HTML。测试覆盖实际浏览器上传／下载，不只是直接调用内部方法。

**不是**输入重演、录像、回滚／联网同步或可继续战斗的存档；不回放音频、粒子、命中框，不重新模拟 AI。600 步是当前有界记录长度，不是无限录制。独立 HTML 导出继承引擎选项和原有自定义动作／路线；已录 JSON 保存的是结果，不会随后来改选项而重算。

桌面 1440 与模拟 390×844 触摸视口已检查。打开面板暂停对战，关闭恢复同一对战的原暂停状态；生成新训练场景时保持暂停。Esc 与点击关闭走一致生命周期。

## 4. 最终构建验证

以下结果均绑定本次最终 HTML 指纹；继承测试的 suite 名称保留 flow7 以标识来源，但实际执行的是 v8。`final-regressions.json` 同时保存各命令起止时间、输出日志 SHA 和最终 HTML 指纹。

| 检查 | 实际结果 | 证据 |
|---|---:|---|
| 新引擎浏览器合同 | {b['passed']}/{b['total']} | `browser-contracts.json` |
| 记录／重建数值比较 | {b['roundtripCoordinates']} 次；最大角误差 {b['maxAngleError']:.3g} | 同上 |
| 八角色双向状态／绘制纯度 | {m['charactersPassed']}/{m['charactersTotal']}；{m['compared']} 次源角比较 | `state-matrix.json` |
| 新表现开启／关闭的真实路线对照 | {m['routePairsPassed']}/{m['routePairsTotal']} 对，共 {m['actualRouteExecutions']} 次执行 | 同上 |
| 桌面／触摸模拟、实际上传下载与暂停恢复 | {u['passed']}/{u['total']} | `ui.json` |
| 独立 HTML、用户动作／路线与二次导出 | {a['passed']}/{a['total']} | `portability.json` |
| 继承 Node 合同／核心 | 68/68、76/76 | `inherited/` |
| 继承浏览器合同／原战斗机制／逐招回放 | 81/81、39/39、522/522 | `inherited/` |
| 显示调度／G 单步练习 | 72/72、36/36 | `inherited/render-and-practice.json` |
| 三档特效的战斗不变性／八角色有限连携 | 36/36、16/16 | `inherited/` |
| 22 条路线双向及真实取消 | 44/44、106/106 | `inherited/transition-matrix.json` |
| 自然地面收招 | 195/195 | `inherited/recovery-observation.json` |
| 当前源码、资产、证据及冻结指纹 | {v['passed']}/{v['total']} | `validation.json` |

不要将不同维度的检查简单相加成“几万个用例”。例如 14,720 次源角比较是 16 个场景内部的采样，不是 14,720 条不同连段。真实取消和自然收招的微小数值误差也不覆盖投技、空中换边等所有状态。

## 5. 两段实际持续运行

### 5.1 最终对战持续运行

开始：{e['startedAt']}；结束：{e['finishedAt']}；实测 **{e['elapsedWallSeconds']:.3f} 秒**，不是加速模拟得出的时长。完成 **{e['completedRoutes']} 条真实连段**，创建 {f.get('recordings',0)} 次真实姿态记录、打开 {f.get('reviews',0)} 次回放、检查 {f.get('pausedChecks',0)} 次暂停和 {f.get('inspections',0)} 次骨架检视。期间循环方向、节奏、速度、特效、角色／路线，持续真实 rAF 绘制。

未记录到连段失败、未处理浏览器脚本错误或容量越界。观察到的最大残影槽 {f.get('maxGhostSlots')}／6、回放步数 {f.get('maxReplay')}／600、状态事件 {f.get('maxStateEvents')}／160、世界粒子 {f.get('maxParticles')}／320。完整结果和逐路线记录：`endurance.json`；每分钟检查点及截图均保存。

强制 GC 检查点的 JS 堆使用约 {min(gc)/1048576:.2f}–{max(gc)/1048576:.2f} MiB；这些是观测值而非整机内存或“完全无泄漏”证明。容器限制 4 GiB，期间另有对照截图与回归工作；时钟的追赶／丢步计数原样保留，不能宣称设备始终达到 60 fps。

### 5.2 导入／倒拖／开关面板压力

另行实测 **{s['elapsedWallSeconds']:.3f} 秒**，完成 **{sf.get('cycles')} 次** JSON 解析、装载、反复小数帧定位和结果比较，并交替骨架层和关闭／重开面板。输入是通过真实模拟生成的行走、跳跃、扫腿和连段四份记录，不是假姿态。

原对战步号保持不变，倒拖回同帧的曲面路径一致；回放角色根节点始终为两个，记录和事件容量未越界；未记录到脚本错误。GC 检查点 JS 堆约 {min(sgc)/1048576:.2f}–{max(sgc)/1048576:.2f} MiB。证据：`replay-stress.json`。这仍是指定负载下的测试，不保证任意机器、任意导入数据都具有相同性能。

## 6. 失败记录与未覆盖范围

`qa/flow8/history/` 保留开发期失败和短测试，不混入最终通过数。主要包括：严格导入最初拒绝自身导出的可选默认通道（已修正采集归一化）；Esc 关闭的暂停恢复时序（已修正）；比较脚本查询已移出的 SVG、错误测试招式 ID 和源码检查路径等测试夹具错误（修正测试本身，未改战斗来迎合）。45 秒短测不等于本节的 25 分钟持续运行。

本环境的原生 `file://` 导航被策略以 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻止；测试使用完整独立 HTML 字节并实际执行文件上传／下载。没有验证用户本机目录选择授权，也没有以触摸模拟替代手机真机帧率。

当前仍为 2.5D SVG，不是全身 3D、完整布料物理。双人投技沿用耦合握持求解，未强行加入双方独立平滑；规则换向仍离散镜像，极端自定义动作不保证全部自然。受击躯干有意即时反应，不声称所有状态／导数零跳变。没有官方游戏逐帧节奏基准，本版保留 v7 的 1× 和可选 0.85×，未暗中放慢默认战斗。

## 7. 使用与复核

先打开创作版首页「打开实战动作回放」，查看「跳跃 → 落地 → 缓冲」约 48–60F，然后运行「真实扫腿 → 倒地 → 起身」。对照视频先看最后的 OD 冲刺，旧版游离部件影子与新版实际人物残影的区别最直接。新开关影响之后运行的模拟，不重算旧记录。

v8 使用独立存储，不自动覆盖 v7；旧个人工程先导出备份。原动作、骨架、模型和路线格式仍兼容。回放 JSON 通过「导入回放」读取，不要误当成动作工程。

```text
python tools/build_forge.py
python tools/check_flow8.py
python tools/check_flow8.py --run
python tests/flow8/final-regressions.py
python tests/flow8/endurance.py --seconds 1500
python tests/flow8/replay-stress.py --seconds 180
python tests/flow8/capture-comparison.py
python tools/check_flow8.py --evidence --require-soak
```

浏览器测试需 Python Playwright 与 Chromium；构建只依赖 Python 标准库。`--evidence` 是对已存证据的指纹核对，不是再次运行测试。完整源包内含两份 HTML、代码、原资产、测试、视频、截图、输入 v7 归档与文件清单。最终 ZIP 解压后逐文件校验、删除预生成输出再重建两份 HTML 的结果，见包外 `INK-Flow-8-Response-Delivery-Check.json`。

最终创作版 SHA-256：`{h}`。

输入 v7 源包 SHA-256：`{d['baselineArchiveSha256']}`。本报告中的结论来自上述本地源码与实际执行证据，不援引外部游戏数据。
'''
 (R/'TEST-REPORT-FLOW8.md').write_text(text,encoding='utf-8');print('Report generated',len(text),'characters; elapsed minutes',elapsed/60)
if __name__=='__main__':main()
