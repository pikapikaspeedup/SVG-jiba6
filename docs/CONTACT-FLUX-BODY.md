# 接触材质与轨迹

MaterialFlow 保留八角色已有材质路径，在 `geometry(rows,time,style)` 中接受 `style.contact` 和 `style.contactTime`。接触必须已转换到 rows 的坐标系；人物动作帧与世界接触时间独立，不能用动作 clip 帧计算接触寿命。纯几何仅调用一次 ContactFlux.deform，默认不添加截面，避免人物附体带和世界尾迹重复发亮。可显式 `contactSection:true` 单独预览截面。

普通技 `category:'normal'` 只输出末五点的一条低透明中性色细线；不使用角色火焰填充或密集多层材质。已有特殊技继续保留波、火、丝、切风、气压、旋涡、扇流、爪焰区别。所有几何层数不超过现有六路径槽，输入点列不改写。

RibbonPool 沿用原有容量和每条最多 64 个历史点。`push` 的 style 记录 source/sourceAttack；`contact(source,snapshot,time)` 仅给同一攻击对象的既有条带保存快照，未来新条带由调用方传入快照。关闭后的尾迹不重新开启，不因接触刷新存活时长。

`stamp(snapshot,time,style)` 用原池分配 contactOnly 条目、复用六路径槽，读取 ContactFlux.section。带 id 的同事件重复提交不重复分配，池满时优先淘汰最老已关闭普通尾迹，再最老其他普通尾迹，最后最老截面；evicted 记录替换数量，active 不超过原容量。普通 push 满池仍拒绝并计 dropped；生命周期取 snapshot.duration 且不超过 12 帧。正式接触事件唯一调用 stamp，绘制不派发事件。

MaterialFlow.contact 的尾屑以 contact.responseDir 或 response.responseDir 定向，防住紧凑压散、parry 偏转、armor 短促截断、命中向响应方向释放。普通技只两枚短细中性尾屑；多段中间击与 reduced-motion 更少。保留现有池与冻结时钟，不创建光圈或更改战斗规则。

`node tests/contact-flux/material.cjs` 检查跨时钟传递、输入纯度、有限层数、source 精确匹配、截面事件去重、池容量/回收和真实响应向量。使用受控 ContactFlux 接口替身，几何形变本身由 ContactFlux 独立测试覆盖。
