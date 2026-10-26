# 模拟拥有的迈步与停车落脚

`INK.Locomotion` 提供 settings/profiles/active/reset/step/sample/overrideTurn。模块不改战斗根位置、walkT、速度或活动帧，也不调用 Runtime。

`step(f,G,context)` 每动作钟仅执行一次。context 为 `{baseFeet:{front:[worldX,worldY],rear:[worldX,worldY]},scale,actualdx,grounded,eligible,dir,actionclock,profile?}`。baseFeet 应为无 Locomotion/Support 反馈的当步基础脚世界点，地面高度应稳定。profile 可沿用 BodySupport 的 stride/lift/settle/drive，不提供时动态读取 BodySupport.profiles 或模块八角色回退参数，允许提前加载。

step 写不可变 `f._inkLocomotion`：每脚 anchor 和可选 swing `{from,to,start,duration,height}`、weights、next、travel、brake、body。运动依据实际 dx 累积超过三像素启动；零位移墙边不会启动大步。摆动时间随速度在有限范围变化，落点根据基脚和有界前移预测；普通步行始终仅一脚摆动；疾走采用下文独立换脚规则。反向继续当前脚轨迹，下一个步再改变方向。停止后摆脚按同一动作钟完成落地，不把相位停在半空；身体前倾逐步回落。

`sample(f,time,world)` 纯读，返回 `{active,feet,worldFeet,weights,brake,body}`。**feet/worldFeet 都是世界点**；world 参数预留、不执行隐式坐标转换，由 root 使用一致变换接入最终约束。脚底目标的骨架可达性由 FootConstraint 解算，模块自身不伸骨。支持分数动作钟采样，冻结时相同 time 必须得到相同结果。瞬间跨朝向暂 reset，overrideTurn 也是显式 reset 钩子，后续转身合同另接。

动作优先：eligible 推荐仅地面 idle/dash/rush、无攻击无蹲；攻击/受击/防御/投技/空中令 eligible=false 并立即让出，不拉回原攻击腿。reset 用于传送、场景更换。模拟 step 应在实际移动之后执行，姿态采样在最终脚约束前读取，不能在 render 里推进。

`node tests/locomotion/unit.cjs` 覆盖八角色连续迈步→反向→停车序列、两脚交替、停车落地、世界零 dx、重复动作钟不推进、采样纯度与 root 未改写。正式骨架可达与视觉落地待主线程集成检查。

生命周期：原地无旧状态不创建支撑，保留朱莉等角色原生护架。停车仅完成已有摆脚，之后五动作帧 blend 平滑从 1 卸载至 0，再 reset。sample 的 feet 仍为世界脚点，root 以 blend 与当前真实基础脚目标混合；body 已乘 blend。brake 仅在实际 moving→stop 或 dx 符号反转触发，七帧衰减，反向收髋和下沉随同退出。快照 previous 只保留一层（previous.previous=null），分数 time 早于当前快照时读前一快照，避免新步未来目标提前进入。短测额外覆盖该时间边界、卸载单调性与不占用原地护架。

可达规划：可选 `context.reach[name]=[minWorldX,maxWorldX]` 是主线程从真实骨长与当步躯干姿态计算的地面可达区间。新落点限制在该区间内；支撑脚按实际 dx 预测下一帧出界时，当前摆脚从当前 footAt 位置连续改为两帧落地（不追加抬高），只加速一次，随后优先释放危险支撑脚。固定 anchor 从不被偷偷平移。此策略不保证极端速度或奇异投影下零残差，最终求解仍需报告实际可达误差。

`bodyLoad(f,{dx,scale,profile}) -> {drop}` 提供单一纯计划接口，返回 8–14 的原始 local 下沉值；运动按实际速度/角色 load 变化，停车保留到摆脚完成再由 sample.blend 卸载。sample.body.bob 已包括 drop 与短刹步起伏，BodySupport 的 profile.load 应只乘一次。规划 reach 的基础姿态先加同 drop×profile.load，不动战斗 root。

连续性补强：`context.startFeet` 可传上一模拟状态实际最终脚点，首次接管以它为 anchor/from；目标仍是 baseFeet 的地面点，避免朱莉原生抬脚被归地初始化。急落改为靠当前摆脚的 `from.x+actualdx×2`，再限制到当步 reach，不能沿用遥远原目标；若可达域本身很远，按真实距离延长时长，平移峰速不超过 18 local 单位/动作帧，而非强制两帧。

常规新摆脚先限制期望水平摆距为两倍角色 stride，再限制在真实 reach；时长预算同时覆盖 smoothstep 的 1.5×平移峰速与抬脚的 π×高度导数。步行至冲刺预算为 18–24 local 单位/动作帧。极端可达域导致摆动必须延长时，允许支撑约束留下诚实残差，不挪 anchor 或改变战斗速度来伪造锁脚。新增远 159 单位情景检查限速与保留可达域。

完整转身交接：`adopt(f,worldFeet,{time,dir,scale,...})` 是模拟侧提交入口，原样接收 front/rear 世界 XYZ，建立 adopted 支撑，不重新吸附 baseFeet，也不冒充有根位移。原地保持该姿态直到下一真实移动或动作接管；下一步从这些锚起步。sample.feet/worldFeet 保持二维兼容，feet3D/ownedFeet 返回 XYZ。顺序必须是 FacingMotion.step 产生 handoff → Locomotion.adopt 成功 → FacingMotion.completeHandoff 确认。未成功采用前不得释放 Facing 脚约束。adopted 无自动卸载到 authored 站姿，避免下一帧回跳；普通行走停车仍使用既有有限 handoff 卸载。

停车卸载与可达修正有明确所有权：无位移时，可达边界纠正只能发生在 `releaseStart === null`。一旦开始向固定 handoff 足点卸载，新的轻微边界变化不能重新启动摆脚、将 blend 拉回 1；真实移动输入造成根位移时仍从当前实际脚位置续接步态。

## 疾走计划（phase9）

实际速度达到 9 local/F 进入 `mode: run`，低于 7 退出。疾走每脚独立判断支撑剩余距离，预计约 2.5 帧后越界便提前卸载；允许 `sample.flight` 表示短暂双脚低权重，绝不修改战斗高度或空中状态。未来落点按真实 dx 和有界加速度预测 3.5–5 帧，将当前三维地面可达区间平移至预计根位置后选取内部点。Hermite 摆脚保存起始位置与速度，停步时一次性撤回向前预测，继续有限制动落地。骨长和战斗根位置不变。

`samplePlan` 兼容疾走快照，供独立攻击交接读取。该快照仅代表已提交轨迹；攻击余势移动由新的模拟交接计划接续，不应由渲染猜测根速度。已检查隆疾走和嘉米墙停，完整顺序图见 `qa/locomotion/run-sequence.png`，对应报告 `run-v3.json`。首次短回收后同脚继续向前送，起步至少错开两帧；速度预算最高 32 local/F，不改变战斗根速度。隆最大脚位移 26.969 世界单位/帧（首版为 60.065），墙停保持稳定。呈现保持护架的疾走追身步；尚非自然交叉腿跑步，躯干偏直立。

`strikePlan(plan,{time,world,frame,deadlineFrame,carry,dir})` 是模拟提交用纯构造器，返回冻结且兼容 `samplePlan` 的脚计划。`frame.worldFeet` 为交接时实际世界 XYZ；`deadlineFrame.worldFeet` 应在出招当前根位置求得，不预加余势，函数再按 dir 添加最多 18 世界单位 carry。运动脚保留原采样速度、从实际可见脚点出发，重新落向攻击站姿，至少四帧；已站稳的脚原地保持，不把双脚一起搬到攻击站姿。若无 deadlineFrame，运动脚原水平位置落地。攻击腿的活动帧权限仍由 FrameBridge 决定，此函数不改变战斗或接触时序。
