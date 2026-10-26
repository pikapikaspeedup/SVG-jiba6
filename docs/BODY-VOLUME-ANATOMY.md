# 肢体表面体积元数据

Anatomy 在既有骨架投影完成之后提供 `rig.anatomy.surfaces[name]`，name 为 rearArm/frontArm/rearLeg/frontLeg。此数据只服务皮肤轮廓、衣料分面与遮挡排序，不能反向驱动关节或战斗判定。

每条肢体提供以下冻结字段：

| 字段 | 含义 |
| --- | --- |
| character | 实际角色 id |
| foreshortening[2] | 上下段投影后长度除以同坐标系投影前长度，限制 0–1.25；零长度回退 1 |
| depth[3] | 既有三个关节点虚拟深度的独立冻结副本 |
| segmentDepth[2] | 两段各自端点的平均深度 |
| turn.angle/cos/sin | 既有投影角度及三角值 |
| bend.cross/dot | 投影后上下段单位方向的叉积和点积；退化段取零向量 |

容器 surfaces 以及所有嵌套数组/对象冻结，anatomy.surfaces 属性不可重新赋值。原 anatomy.depth 与其他已有对象不额外冻结，避免改变旧接口合同。

## 所有权

不改变 sourceRig、IK 长度、projectors、投影后的 joints/sockets、depth、turns、handMatrix 或 footMatrix 的计算。`surfaceInfo(character, original, projected, depth, angle)` 纯读取计算，可单独检查。solve 每条肢体只产生固定两段元数据，无历史、随机数或逐帧积分。

角色差异来自实际 rig 尺寸和同一姿态下不同骨架的投影关系。此模块不为了“八角色不同”造出八套假短缩；当前检查中实际骨架产生四组不同测量签名。具体肌肉/衣料轮廓差异仍由 SkinGeometry 的角色 morphology 决定。

SkinGeometry 接收 `sampled(chain,widths,shape,surface)` 的可选第四参数；Renderer 读取同一条 limb 的 surfaces。短缩可用于保留厚度与压褶，深度可辅助前后段遮挡，但不能据此扩大命中框或改变手足目标。

## 已检查边界

运行 `node tests/body-volume/anatomy.cjs`：读取八角色现有 model/rig，采样七个转角和两种弯折，共 112 个姿态。检查关节与既有投影公式一致、手足矩阵公式一致、元数据深冻结、输入不变、重复采样相同、短缩与转面有限，以及零长度段回退。此处未运行浏览器，亦不宣称全招式穿插已消除。
