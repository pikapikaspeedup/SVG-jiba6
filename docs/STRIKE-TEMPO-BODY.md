# 重攻击蓄势与假动作身体表现

`src/ink/strike-tempo-fx.js` 只采样模拟已提交的节拍，公开 `settings`、`profiles`、`active()`、`phase(f)`、`pose(f,source)`。Runtime 在 StrikeMotion 后、关节桥之前调用 `pose`。总开关联动 Kinetic，复制姿态并继承 Articulation 元数据，不写 fighter、攻击帧、碰撞、资源或根位置。

模拟契约：`attack.tempo.phase` 为 armed/holding/released，`age` 为累计蓄势动作帧；攻击停留于 `startup−3`。armed 在门槛前两帧平滑进入，holding 的 12 帧沿单向沉髋→反扭路径增加承重，不循环播放出拳。released 依据原攻击 t 在剩余三帧平滑归零，由原 StrikeMotion 接续正式接触发力。提前松开且未到门槛时也连续退出，保持原招式活动帧。

隆沉髋后腿承重；肯向前压肩；春丽折膝反向绕胸；嘉米交叉髋轴；卢克低头紧护；朱莉大幅髋肩反转并收膝；舞以扇侧后肘弧线蓄势；八神前俯低架。重脚进一步屈膝，后护手随肩保持保护。攻击手腕、双脚末端不由此层移动，膝肘作为固定骨长解算导向，最终骨长由既有关节求解器维持。并非动力学仿真。

付费假动作读取 `f._inkTempo={phase:'feint',age,move}`，要求模拟层仅在可行动 tick 更新 age，12 帧结束清理。capture 桥承担从原蓄势架势的连续交接，本层以零起点收手弧线进入，末段归零回到普通姿态；不保存第二份姿态快照，不增加无敌或缩短恢复。冻结时 age/t 不变，重复采样完全一致。

短检查：`node tests/strike-tempo/pose.cjs` 覆盖八角色拳脚路径差异、输入/源姿态纯度、固定攻击端点、冻结重复采样、朝向局部一致性与三种相位端点。此检查不替代构建后的正式画面检查；实际支撑与桥接效果由 Runtime 最终骨架决定。
