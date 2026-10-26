# 主动出招节奏：规则合同

本轮增加站立重拳、站立重脚的蓄势和付费假动作。收益是改变出手时机；不改变原招伤害、判定、活动帧或收势时间。原始动作资产保留。

## 合法输入与时间

仅地面、中立起招的 `sHP` / `sHK` 可武装。连携、冲刺强化、空中、Luke 特殊闪光拳不进入此模块。`started` 必须收到真实启动按钮的本次按压令牌；直接 `move` / `tryMove` 没有令牌，保持普通轻点出招。开始前已松开也不蓄势。

模拟到 `startup - 3` 时，原始按钮仍按住才保持该攻击帧；最多吞掉 12 个可行动步。松开匹配按钮只登记 pending release，下个可行动步恢复原攻击推进，保留原有最后 3 帧启动。其他按钮释放不解蓄势。重复按压不能把新令牌冒充旧起招令牌。相同 actionTick 重复 step 不重复计龄。

命中定格和暂停渲染不推进保持年龄。用户明确逐帧推进时，模拟调用 actionable=true 正常前进一帧。失焦等 clear 默认安全释放，不自动付费；受击、捕获、倒地和场景重置应使用 cancel 清除。模块不推进全局时钟。

## 主动收招

公共动作 `FEINT` 只在 holding、尚未释放且没有接触时可用，成本 0.5 Drive。成功后进入 12 帧 recovery，移除无敌与投保护、清输入队列、不移动根位置。普通引擎须禁止该恢复段取消；不能让已有连携或防守入口绕过恢复。方向加按键仅是入口映射，CPU 与玩家使用同一个公共请求。

## 集成 API

- `press(f, button, G)`：真实新按下六个基本攻击键后返回令牌（蓄势仍只接受 HP/HK）；调用方把令牌带到本次 interpret 起招。
- `started(f, G, {origin, neutral, chain})`：创建 attack 后武装；neutral 必须取起招前状态。
- `released(f, button)`：登记松键，不在输入回调更改攻击帧。
- `clear(f, {cancel})`：释放或销毁蓄势。
- `step(f, G, {actionable})`：在可行动攻击更新中调用，返回 true 时跳过普通 attack.t++。
- `decision(f, 'FEINT', G)` 与 `startFeint(f, G, {pay,state,notify})`：共享合法性与唯一支付入口。root 不应预付后再次调用 pay。

attack.tempo 提供 armed/holding/released、age、originButton、pressSerial；模拟保持时 t 固定。假动作在 f._inkTempo 保存 phase=feint、started、duration、dir、move。表现仅采样，不改战斗骨架和结果。假动作年龄可从当前 actionTick 与 started 得出，状态中断后必须忽略快照。

## 有限验证

`node tests/strike-tempo/unit.cjs` 覆盖 12 步上限、重复 step、原键所有权、冻结期间释放、唯一支付、恢复时间和清理。真实输入、CPU、状态入口取消保护由根集成后进行短实战检查；此单测不宣称全链路已验收。

## 正式接入与本轮证据

实际键盘 L/O、练习区按住按钮与 CPU 均走真实输入令牌；后 + F 是假动作入口。CPU 在合法中立重击选择中少量使用蓄势，按 3–9 行动帧释放，仅使用已有延迟观察决定是否收招。短样本自然出现持有/释放，未自然覆盖 CPU 假动作分支。Luke 闪光拳现绑定原始拳键，松无关按钮不会打断；原 18–24 帧完美窗口与 36 帧超时数值保留，释放在模拟帧结算。

本轮 17 项真实规则、18 组姿态、6 项输入/暂停、3 项 CPU 汇总及 6 项源码合同检查通过，见 `qa/strike-tempo/checkpoint.json`。16 种实际蓄势同步 CPU 样本平均 1.10–1.45 ms，非显示帧率。原 707 资产保持；没有新 Pro 咨询。
