#!/usr/bin/env python3
"""Write the release report only from passing, hash-bound current evidence.
Does not run tests and does not change runtime or game assets.
"""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'qa/flow5'


def read(name):
    return json.loads((QA / (name + '.json')).read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    from check_flow5 import aggregate
    validation = aggregate(require_soak=True)
    session = read('work-session')
    assert session.get('measuredElapsedSeconds', 0) >= 3600, 'One actual hour has not been recorded'
    first = datetime.datetime.fromisoformat(session['firstRecordedAt'])
    measured_to = datetime.datetime.fromisoformat(session['measuredToAt'])
    assert (measured_to - first).total_seconds() >= 3600
    assert measured_to <= datetime.datetime.now(datetime.timezone.utc), 'Cannot use a future end time'
    assert abs((measured_to - first).total_seconds() - session['measuredElapsedSeconds']) < .002
    soak = read('endurance')
    core = read('core')
    regression = read('regression')['results']
    extra = read('extra-regression')['results']
    audit = read('source-audit')
    compiled = next(t['detail'] for t in core['tests'] if t['name'].startswith('Compiled sampler preserves'))
    sockets = read('socket-matrix')
    benchmark = read('benchmark')
    contacts = read('contact-metrics')
    rebuild = read('source-rebuild')
    checkpoints = soak['checkpoints']
    final = soak['final']
    environments = soak['environment']
    headless_heaps = [r['heap']['usedSize'] for r in checkpoints] + [soak['finalHeap']['usedSize']]
    dropped = max(r['clock']['discardedSteps'] for r in checkpoints)
    clamped = max(r['clock']['clampedMs'] for r in checkpoints)
    tables = []
    for name, label in [
        ('core', '新引擎数学、配置与边界'),
        ('browser', '浏览器接线、编辑、检视与响应式'),
        ('compatibility', '真实连段／分层开关／渲染计划对照'),
        ('socket-matrix', '舞的实际 SVG 扇柄／扇尖挂点'),
        ('rhythm-matrix', '舞的 DOM G 键节奏与长按防代打'),
        ('portability', '修改后导出、独立加载、再导出与旧数据导入'),
        ('dual-actor', '双舞实战实例隔离与模拟手柄门控'),
    ]:
        r = read(name)
        tables.append(f"| {label} | {r['passed']} / {r['total']} | `qa/flow5/{name}.json` |")
    for name, label in [('ink', '原 IK 与动作基础'), ('forge', '原工坊基础与资产校验'), ('flow', '原连段数学')]:
        r = regression[name]
        tables.append(f"| {label} | {r['passed']} / {r['total']} | `qa/flow5/regression.json` |")
    tables.append(f"| 原战斗机制 | {len(regression['mechanics'])} / {len(regression['mechanics'])} | `qa/flow5/regression.json` |")
    tables.append(f"| 八角色逐招回放 | {len(regression['replays'])} / {len(regression['replays'])} | `qa/flow5/regression.json` |")
    for name, label in [('storage', '存储接口合同（使用测试替身）'), ('states', '状态与恢复'), ('retained', '保留式 SVG 与资源边界')]:
        r = extra[name]
        tables.append(f"| {label} | {r['passed']} / {r['total']} | `qa/flow5/extra-regression.json` |")
    hashes = '\n'.join(f"{name}\n  {item['sha256']}" for name, item in validation['artifacts'].items())
    memory_unchanged = environments.get('memoryEventsBefore') == environments.get('memoryEventsAfter')
    memory_text = '本轮单实例运行前后，容器内存事件计数没有增加。' if memory_unchanged else '本轮运行前后容器内存事件计数见 endurance.json；不能将容器事件直接归因于某个页面。'
    elapsed = session['measuredElapsedSeconds']
    text = f'''# INK FLOW 05 · 动作与特效引擎迭代验收报告

## 交付结论与计时

版本 **5.0.0**。在用户提供的 FLOW4 源码上实现三个目标：正式的时钟/动作求值管线，舞的分层动作与附件动力学，模拟拥有的特效生命周期与路径发射。完整目标及边界见 `PLAN-FLOW5.md`，配置和模块接口见 `docs/FLOW5-ENGINE.md`。

本轮从首个保存的时间记录 **{session['firstRecordedAt']}** 至 **{session['measuredToAt']}**，实际墙钟 **{elapsed:,.3f} 秒（{int(elapsed // 60)} 分 {elapsed % 60:.1f} 秒）**。该数字包含源码核对、开发、调试、测试、文档与交付检查，不是以模拟帧换算工作时长；更早的估计开始时间没有用来凑满一小时。记录见 `qa/flow5/work-session.json`。

最终游戏构建单独完成 **{soak['elapsedWallSeconds']:,.3f} 秒**连续真实浏览器运行，完成 **{soak['completedRoutes']} 条实际连段**。当前构建的全部验收记录通过，绑定同一个创作版 HTML SHA-256；历史 FLOW4 记录不算本轮通过证据。没有在线提交、发布、部署或修改远程仓库。

## 为什么这次是运行路径的改变

FLOW4 并非完全没有运行时增强；问题是主集成隐藏在构建器字符串补丁中，动作资产与视觉附件的改变又比核心管线更显眼。FLOW5 没有仅把旧 `game.js` 改名：先把 FLOW4 真正执行的集成源落到正式文件，再接入新调度器与模块。`qa/flow5/live-integration-diff.patch` 对比的是 **FLOW4 实际内嵌运行源码**，不是仅利用旧未集成文件制造大差异。

现在 `tools/build_forge.py` 直接读取正式 `game.js`，不再字符串替换战斗函数体。`dist/game-forge.js` 与 `game.js` 逐字节一致。七个独立模块被实际游戏、编辑器和检视窗口调用：

| 实现文件 | 实际职责 |
| --- | --- |
| `compiled-motion.js` | 预编译关键帧系数、二分定位、保留旧曲线和完整旋转 |
| `engine-clock.js` | 60 Hz 固定模拟、显示插值、暂停/切屏清理积压、限额追赶 |
| `motion-graph.js` | 有序叠加/覆盖层、权重/遮罩、支撑脚窗口，输出独立视觉姿势 |
| `secondary-dynamics.js` | 发辫与腰带三段阻尼角弹簧，位置/速度，120 Hz 预采样与随机访问 |
| `fx-timeline.js` | 按招式实例管理 start/end/cancel 边沿；仅模拟推进 |
| `fx-emitter.js` | 距离/时间/爆发发射、速度继承、种子随机、生命周期消费者 |
| `ribbon-geometry.js` | 历史挂点的连续带状几何，固定点数，取消后自然消退 |

这些模块与 `runtime.js`、`motion.js`、`game-adapter.js`、`particles.js`、`effects.js`、舞的 SVG 渲染器和工坊协同工作。不是从零重写整套战斗规则，也没有假称全部装饰效果都移除了旧兜底路径。

## 三个目标的验收结果

### 1. 时钟与动作求值

FLOW4 已有固定步长循环，不把固定步长概念说成本轮首创。此次抽离为可测试、带丢步诊断和暂停/切屏重置的模块，并接入生产主循环；基础关键帧经 `CompiledClip` 求值，动作图产出 `visualPose`。原 `pose` 继续负责判定与规则，分层姿态、接触修正和附件输出不写回伤害或攻击覆盖。

690 份资产的 **{compiled['samples']:,} 个姿势／{compiled['components']:,} 个数值分量**与旧采样器比较，最大差异 **{compiled['maxError']:.4g}**，处于浮点计算舍入量级。整圈转身、保持段、曲线类型、边界和返回对象独立性均有专项断言。

固定时钟使用合成 30/60/120/144/240 Hz 回调计划检验，不冒充真实硬件刷新率测试。反复小数帧重绘不会增加战斗步、事件或世界粒子出生；命中定格冻结发射与粒子年龄。每次回调最多追赶 8 个模拟步，超过限额会统计丢弃而不是无限补算。

16 条路线 × 双朝向 × 动作图开/关，共 64 个真实战斗对照通过，另有 32 个渲染计划对照。既有 16 条路线定义保留；没有为通过测试扩大判定、延长受击硬直、直接写伤害或无限补充资源。

### 2. 舞的分层、附件与连招交接

本轮增加配置的 **{audit['changedRecords']} 份舞记录**覆盖 18 份普通技、20 份必杀、4 份超级必杀和待机。加入躯干反向跟随、扇子跟随、适用站立出招的支撑脚窗口、三段发辫/腰带弹簧参数。**全部 {audit['records']} 份基础关键帧、绑定、判定框与招式标识均与用户 FLOW4 保持一致**；差异是新表现元数据与特效参数，不是把八位角色重新编舞。

合法取消时，单独承接上一招最终视觉姿势及其导数；在下一招首个有效帧前结束短时交接。真实重·龙炎舞（内部标识 `hissatsu_2`）取消至 SA3 的首帧误差和结束残差均有断言。这是表现层交接，不改变原取消门槛。

舞的 43 份资产 × 6 个采样帧 × 双朝向 × 两个扇子挂点，共 **{sockets['passed']:,} / {sockets['total']:,}** 次实际 SVG 坐标核对通过；最大误差 **{sockets['maximumError']:.6f} px**。挂点匹配最终视觉姿势，而非仅检查独立数学辅助函数。

发辫与腰带的弹簧保留角度及角速度，反向拖动和重复求值结果一致。该模型是按动作预采样的简化角链，不是碰撞感知布料或整套身体刚体求解；不能据此声称所有招式取消都连续继承完整布料物理状态。

同帧检视的左侧明确标为当前资产基础轨参考，**不是正在运行一套旧引擎**；右侧调用实战相同求值/发射内核。支持局部开关、逐帧、镜像、慢放、接触/事件时间段和数值观察。局部开关不改写招式，检视期间屏蔽战斗快捷键。工坊参数保存、撤销和导出后仍生效。

### 3. 特效生命周期与发射器

事件调度器按动作实例维护 start/end/cancel，世界发射器消费该组事件，而不是另设一套只用于展示的日志。取消关闭出生；现有火星和拖尾继续衰减。两个角色的实例隔离、同帧事件排序、静默 seek、重复重绘、传送重置、异常大输入和确定性质量子集都有检查。

新的路径发射支持距离间距、每帧时间率、初始爆发和挂点速度继承。拖尾从稀疏孤立线段改为有限历史上的连续带状几何；粒子使用解析阻力/加速度、寿命尺寸与透明度曲线及余烬热色过渡。游戏是世界坐标、检视是局部坐标，两者复用核但不会承诺根位移不同仍逐颗粒子完全同位。

容量：世界粒子 320、局部粒子 144、世界拖尾流 64、每流历史及重采样各至多 64 点、根历史 40、挂点缓存 2,048、生命周期日志 256。容量不足时按既定规则丢弃新视觉，不扩大池，也不改变命中。粒子池抵达容量不等于发生越界。

## 当前构建测试矩阵

| 测试范围 | 结果 | 原始记录 |
| --- | ---: | --- |
{chr(10).join(tables)}

各套件包含不同层次与重复场景，不把这些数字相加宣传成互不重复的总测试数。720 项工坊检查包含逐资产验证；G 键 0F 提前输入的负面用例要求正确拒绝，而不是让每一种错误输入都完成连段。手机部分是 Chromium 视口与触摸模拟，不是实体手机性能验证。

独立导出验证实际修改分层/弹簧/发射参数，导出创作版和玩家版，重新加载并再次导出；新参数与引擎模块保留。舞的扩展路线实际 **14 HIT / 3375 伤害**，不是手写战斗结果。该套件记录的外部网络请求与未处理浏览器脚本错误为空。

## 最终构建的真实持续运行

开始：`{soak['startedAt']}`。结束：`{soak['finishedAt']}`。连续运行计时取单调墙钟 **{soak['elapsedWallSeconds']:,.3f} 秒**，不是按模拟帧倒推。

一个持续渲染的 Chromium 页面完成 **{soak['completedRoutes']} 次连段**，以舞为主并穿插其他角色，切换左右方向、特效质量/低闪动模式、动作工坊倒拖、演武与引擎检视。完成 **{final['inspections']} 次引擎检视、{final['views']} 次附加视图切换、{final['pausedChecks']} 次暂停不推进检查**。最终记录中没有连段失败、未处理脚本错误或池越界；真实渲染回调计数 **{final['raf']:,}**。

检查点采集到的世界粒子峰值 {final['maxParticles']}，世界拖尾流峰值 {final['maxTrails']}，根历史峰值 {final['maxRoots']}，活动发射器角色归属峰值 {final['maxActors']}，生命周期日志峰值 {final['maxLifecycle']}。每分钟强制回收后的 JavaScript 已用堆和最终样本范围约 **{min(headless_heaps) / 1048576:.2f}～{max(headless_heaps) / 1048576:.2f} MiB**；这是本次采样现象，不能证明永远没有泄漏，也不等于整个浏览器/操作系统内存。

最后一个分钟检查点累计丢弃模拟步 **{dropped}**，累计截断墙钟 **{clamped:.3f} ms**。这些计数被明确记录，不把限额追赶说成任意设备恒定 60 FPS。完整采样见 `qa/flow5/endurance.json`。{memory_text}

**未隐藏的失败/中止尝试：** 构建冻结前的一轮因修正剩余版本标签而中止；最终构建第一次并行浏览器长测出现页面崩溃，当时 4 GiB 容器记录到内存不足终止进程。不能仅凭该事件断定具体哪一个进程是根因。两轮均不计通过时间，记录保留在 `endurance-pre-freeze.json` 和 `endurance-failed-concurrent.json`。上述通过结果来自之后单实例从头运行的完整 20 分钟，不是把多轮失败时间相加。

补充测试工具也保留修正记录：双角色检查首版误调用未导出的私有手柄函数，随后又把原生对话框的异步 close 事件误按同步检查；最终改为真实 rAF 轮询并等待关闭事件，6 项重新执行通过，未改动游戏源码。一次总测试工具调用被外层超时中止，完整顺序重跑记录为 `qa/flow5/final-verification.log`，不把中止日志当作完整通过。

## 有限条件下的测量，不作整体帧率宣传

独立 Node 采样器微基准：4 份舞资产，每轮 {benchmark['samplesPerRun']:,} 个姿势，{benchmark['repetitions']} 轮，热身 {benchmark['warmup']:,} 次。旧采样中位 **{benchmark['legacyMedianMs']:.3f} ms**，预编译中位 **{benchmark['compiledMedianMs']:.3f} ms**，耗时比 **{benchmark['ratio']:.3f}×**。这不包含动作图、弹簧、SVG/DOM、绘制或 GPU；不能写成整款游戏的加速比例或真机 FPS 提升。

支撑脚的辅助测量：固定世界根、相同躯干层、去除接触淡入淡出，对 {contacts['windows']} 个窗口／{contacts['samples']:,} 个踝点样本，平均目标偏差由 **{contacts['withoutConstraintMeanPx']:.3f} px** 降到 **{contacts['withConstraintMeanPx']:.3f} px**。这不是战斗中脚尖轮廓的普适指标；超出腿长、校正上限或历史窗口时仍会滑动，没有通过拉长骨骼冒充完美脚锁。原始条件和逐招数据见 `contact-metrics.json`。

## 源码、重建与文件指纹

创作版与玩家版均为完整内嵌的独立 HTML。当前输出指纹：

```text
{hashes}

game.js
  {validation['gameSha256']}
legacy/game-flow3.js
  {validation['legacySha256']}
```

预检源包 `{rebuild['archive']}` 已在全新目录解压，逐项核对 **{rebuild['manifestFilesVerified']}** 个文件指纹，再重新构建两份 HTML；结果与上述输出逐字节一致。该报告明确保留“Preflight”标记，**不是拿预检 ZIP 的哈希冒充最终 ZIP**。

最终发布 ZIP 的逐文件校验及解压重建结果单独交付为 `INK-Flow-5-Engine-Delivery-Check.json`；它包含最终 ZIP 的 SHA-256，因此放在 ZIP 外避免自引用。源码内 `SHA256SUMS.json` 覆盖源码、资产、报告与产物，不包含清单本身。重新验收命令：

```sh
python tools/verify_flow_package.py
python tools/prove_flow5_rebuild.py ../INK-Flow-5-Engine-Source.zip
python tools/check_flow5.py
python tests/flow5/endurance.py --seconds 1200
python tools/check_flow5.py --report-only --require-soak
```

应先核对未改动的交付包，再重跑测试；测试会改写 QA 时间戳和结果，再核对原清单会合理地报告这些文件已变化。测试按顺序运行，避免低内存环境同时启动多组浏览器。`--report-only` 不运行测试，只对已保存证据做版本/哈希/通过状态检查。

## 使用建议与已知边界

先备份旧编辑，再打开新创作版首页的 **「打开引擎检视」**。龙炎舞 22～28F 分别开关分层、支撑脚和弹簧；随后进入舞的真实 14 HIT 连段。不要通过旧缓存页面的版本标题判断已加载新构建。

v5 使用独立浏览器存储，不覆盖 v4。旧工程导入按整招覆盖，不是语义合并：旧招式缺少 `motion5` 配置时仍能运行，但该招不会凭空获得本轮的新分层参数。完整分层轨道、接触窗口、寿命曲线仍使用 JSON 编排，当前工坊不是通用节点编辑器。

本环境实际 `file://` 被浏览器管理员策略拒绝，记录为 `ERR_BLOCKED_BY_ADMINISTRATOR`。当前浏览器测试加载完整 HTML 字节；没有宣称已验证用户机器双击、文件夹授权或持久化权限。存储合同使用测试替身；实体手机、实体手柄、Firefox/Safari 和长期跨设备存档不在本轮实测范围。

没有新增网络回滚、全身碰撞布料、音频引擎、3D 模型或官方动画移植。保留非官方 SVG 同人格斗与原素材权利说明；不将这些未实施项目包装成本轮完成内容。
'''
    target = ROOT / 'TEST-REPORT-FLOW5.md'
    target.write_text(text, encoding='utf-8')
    print(json.dumps({'report': str(target), 'bytes': target.stat().st_size,
                      'sha256': digest(target), 'currentHtmlSha256': validation['artifacts']['INK-Street-Fighter-6.html']['sha256']},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
