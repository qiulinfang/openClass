<template>
  <div class="debug-panel-wrapper" :class="{ expanded: isVisible }">
    <!-- 收缩/展开按钮（右侧边框垂直居中） -->
    <q-btn
      :icon="isVisible ? 'chevron_left' : 'chevron_right'"
      round
      dense
      unelevated
      class="toggle-button"
      :class="{ expanded: isVisible }"
      @click="isVisible = !isVisible"
    />

    <!-- 侧边栏面板 -->
    <q-card class="debug-panel-card">
      <!-- 头部 - 固定在顶部 -->
      <q-card-section class="debug-panel-header">
        <!-- 当前参数数值展示 - 仅显示修改过的参数 -->
        <div v-if="modifiedParams.length > 0 && showParamsDisplay" class="params-display">
          <div class="params-content">
            <div class="params-grid">
              <div v-for="param in modifiedParams" :key="param.key" class="param-item">
                <span class="param-label">{{ param.label }}:</span>
                <span class="param-value">{{ param.formatted }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="header-top">
          <div class="header-title">🔧 知识图谱调试面板</div>
          <q-space />
          <q-btn
            :icon="showParamsDisplay ? 'visibility_off' : 'visibility'"
            flat
            round
            dense
            size="xs"
            :title="showParamsDisplay ? '隐藏参数' : '显示参数'"
            @click="showParamsDisplay = !showParamsDisplay"
            class="q-mr-xs"
          />
          <q-btn icon="close" flat round dense size="xs" @click="isVisible = false" />
        </div>

        <!-- 功能按钮 -->
        <div class="header-actions">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="重置所有参数"
            @click="resetAllParams"
            size="xs"
            dense
            class="q-mr-xs"
          />
          <q-btn
            outline
            color="secondary"
            icon="save"
            label="保存到本地"
            @click="saveToLocalStorage"
            size="xs"
            dense
            class="q-mr-xs"
          />
          <q-btn
            outline
            color="positive"
            icon="restore"
            label="从本地加载"
            @click="loadFromLocalStorage"
            size="xs"
            dense
          />
        </div>
      </q-card-section>

      <!-- 参数控制区域 -->
      <q-card-section>
        <!-- ========== 一、轨迹与位置参数 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm" style="color: #1976d2">
          📍 轨迹与位置
        </div>

        <!-- 椭圆半径参数 -->
        <q-expansion-item
          icon="radio_button_checked"
          label="椭圆轨迹参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- X轴半径 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="horizontal_rule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">X轴半径 (radiusX)</div>
                      <span class="text-body2 text-primary q-ml-md"
                        >当前: {{ localParams.radiusX }}px</span
                      >
                    </div>

                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制椭圆轨迹的水平半径，影响节点在水平方向的运动范围<br />
                      <strong>放大效果：</strong
                      >节点在水平方向上分散得更开，椭圆更宽，左右间距增大<br />
                      <strong>缩小效果：</strong>节点在水平方向上更紧凑，椭圆变窄，左右间距减小
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusX"
                  :min="300"
                  :max="1000"
                  :step="10"
                  label
                  :label-value="`${localParams.radiusX}px`"
                  color="primary"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusX" />
                  <span class="text-caption text-grey-6">默认: {{ defaultParams.radiusX }}px</span>
                </div>
              </q-card-section>
            </q-card>

            <!-- Y轴半径 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="vertical_align_center" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">Y轴半径 (radiusY)</div>
                      <span class="text-body2 text-primary q-ml-md"
                        >当前: {{ localParams.radiusY }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制椭圆轨迹的垂直半径，影响节点在垂直方向的运动范围<br />
                      <strong>放大效果：</strong
                      >节点在垂直方向上分散得更开，椭圆更高，上下间距增大<br />
                      <strong>缩小效果：</strong>节点在垂直方向上更紧凑，椭圆变矮，上下间距减小
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusY"
                  :min="200"
                  :max="800"
                  :step="10"
                  label
                  :label-value="`${localParams.radiusY}px`"
                  color="primary"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusY" />
                  <span class="text-caption text-grey-6">默认: {{ defaultParams.radiusY }}px</span>
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 交互参数 -->
        <q-expansion-item icon="pan_tool" label="交互参数" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 拖拽阈值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="gesture" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">拖拽阈值 (像素)</div>
                      <span class="text-body2 text-primary q-ml-md"
                        >当前: {{ localParams.dragThreshold }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      判断是否为拖拽操作的最小移动距离，小于此值的移动将被忽略<br />
                      <strong>放大效果：</strong
                      >需要移动更远距离才触发拖拽，小幅度移动会被忽略，减少误触，适合精确操作<br />
                      <strong>缩小效果：</strong
                      >只需移动很小距离就触发拖拽，轻微移动就会响应，更敏感但可能误触，适合快速操作
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.dragThreshold"
                  :min="1"
                  :max="20"
                  :step="1"
                  label
                  :label-value="`${localParams.dragThreshold}px`"
                  color="primary"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetDragThreshold" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.dragThreshold }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 二、角度与交互 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #f57c00">
          🔄 角度与交互
        </div>

        <!-- 角度参数 -->
        <q-expansion-item icon="rotate_right" label="角度参数" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 目标角度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="my_location" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">目标角度 (度)</div>
                      <span class="text-body2 text-orange q-ml-md"
                        >当前: {{ localParams.targetAngle }}°</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      知识图谱展开时的目标角度位置（0-360度）<br />
                      <strong>调整效果：</strong
                      >控制展开的图谱应该旋转到圆周上的哪个角度位置（0°=正右方，90°=正下方，180°=正左方，270°=正上方）
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.targetAngle"
                  :min="0"
                  :max="360"
                  :step="1"
                  label
                  :label-value="`${localParams.targetAngle}°`"
                  color="orange"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetTargetAngle" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.targetAngle }}°</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 影响范围 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="radio_button_checked" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">影响范围 (弧度)</div>
                      <span class="text-body2 text-orange q-ml-md"
                        >当前:
                        {{ ((localParams.influenceRange * 180) / Math.PI).toFixed(1) }}°</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      展开图谱周围的影响范围（弧度），在此范围内的其他节点会被推开<br />
                      <strong>放大效果：</strong
                      >影响范围更大，更多节点会被推开，视觉效果更明显，但可能过于分散<br />
                      <strong>缩小效果：</strong
                      >影响范围更小，只有附近的节点被推开，效果更集中，但可能不够明显
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model.number="localParams.influenceRange"
                  :min="Math.PI / 6"
                  :max="Math.PI"
                  :step="Math.PI / 180"
                  label
                  :label-value="`${((localParams.influenceRange * 180) / Math.PI).toFixed(1)}°`"
                  color="orange"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetInfluenceRange" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ ((defaultParams.influenceRange * 180) / Math.PI).toFixed(1) }}°</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 最大推开角度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="open_with" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">最大推开角度 (弧度)</div>
                      <span class="text-body2 text-orange q-ml-md"
                        >当前: {{ ((localParams.maxPushAngle * 180) / Math.PI).toFixed(1) }}°</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      其他节点被推开的最大角度（弧度），距离越近推得越远<br />
                      <strong>放大效果：</strong
                      >推开角度更大，节点分散得更开，避免重叠但可能过于分散<br />
                      <strong>缩小效果：</strong>推开角度更小，节点分散更紧凑，节省空间但可能重叠
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model.number="localParams.maxPushAngle"
                  :min="(5 * Math.PI) / 180"
                  :max="(90 * Math.PI) / 180"
                  :step="(1 * Math.PI) / 180"
                  label
                  :label-value="`${((localParams.maxPushAngle * 180) / Math.PI).toFixed(1)}°`"
                  color="orange"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetMaxPushAngle" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ ((defaultParams.maxPushAngle * 180) / Math.PI).toFixed(1) }}°</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 缩放因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_in" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">缩放因子</div>
                      <span class="text-body2 text-orange q-ml-md"
                        >当前: {{ localParams.scaleFactor.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制距离相关的缩放幅度<br />
                      <strong>放大效果：</strong
                      >距离对节点大小影响更大，展开时附近节点明显变大，远处节点明显变小，大小对比更强烈<br />
                      <strong>缩小效果：</strong
                      >距离对节点大小影响更小，展开时节点大小变化不明显，大小更一致
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.scaleFactor"
                  :min="0"
                  :max="0.5"
                  :step="0.01"
                  label
                  :label-value="localParams.scaleFactor.toFixed(2)"
                  color="orange"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetScaleFactor" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.scaleFactor.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 三、透明度 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #388e3c">
          🎨 透明度
        </div>

        <!-- 状态透明度 -->
        <q-expansion-item icon="opacity" label="状态透明度" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 展开的知识图谱透明度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="visibility" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">展开图谱透明度</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.opacityExpanded.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      展开的知识图谱的透明度值（0-1）<br />
                      <strong>放大效果：</strong
                      >展开的图谱更不透明（更清晰），背景更不明显，前景更突出<br />
                      <strong>缩小效果：</strong
                      >展开的图谱更透明（更模糊），背景更明显，前景更融入背景
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityExpanded"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.opacityExpanded.toFixed(2)"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityExpanded" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityExpanded.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 默认状态下透明度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="remove_red_eye" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">默认状态下透明度</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.opacityDefault.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      默认状态下知识图谱的透明度<br />
                      <strong>放大效果：</strong
                      >未展开的图谱更不透明（更清晰），更容易看到内容<br />
                      <strong>缩小效果：</strong
                      >未展开的图谱更透明（更模糊），更融入背景，突出展开的图谱
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityDefault"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.opacityDefault.toFixed(2)"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityDefault" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityDefault.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 距离相关透明度 -->
        <q-expansion-item icon="blur_on" label="距离相关透明度" class="q-mb-sm">
          <q-card-section>
            <!-- 距离相关透明度最小值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="opacity" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">距离相关透明度最小值</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.opacityNearMin.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      距离展开图谱较近的节点的最小透明度<br />
                      <strong>放大效果：</strong>附近节点更不透明（更清晰），更容易看到细节<br />
                      <strong>缩小效果：</strong
                      >附近节点更透明（更模糊），更融入背景，突出展开的节点
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityNearMin"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.opacityNearMin.toFixed(2)"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityNearMin" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityNearMin.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 距离相关透明度因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="tune" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">距离相关透明度因子</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.opacityNearFactor.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制距离对透明度的影响程度<br />
                      <strong>放大效果：</strong
                      >距离对透明度影响更大，距离变化时透明度变化更明显，层次感更强<br />
                      <strong>缩小效果：</strong
                      >距离对透明度影响更小，距离变化时透明度变化不明显，层次感更弱
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityNearFactor"
                  :min="0"
                  :max="0.5"
                  :step="0.01"
                  label
                  :label-value="localParams.opacityNearFactor.toFixed(2)"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityNearFactor" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityNearFactor.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 距离较远节点透明度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="visibility_off" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">距离较远节点透明度</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.opacityFar.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      距离展开图谱较远的节点的透明度<br />
                      <strong>放大效果：</strong
                      >远处节点更不透明（更清晰），所有节点都更容易看到<br />
                      <strong>缩小效果：</strong
                      >远处节点更透明（更模糊），更融入背景，焦点更集中在展开的节点
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityFar"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.opacityFar.toFixed(2)"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityFar" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityFar.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 四、背景圆形 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #388e3c">
          ⭕ 背景圆形
        </div>

        <!-- 尺寸 -->
        <q-expansion-item icon="crop_free" label="尺寸" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 最小背景半径 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="crop_square" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">最小背景半径 (像素)</div>
                      <span class="text-body2 text-teal q-ml-md"
                        >当前: {{ localParams.minBackgroundRadius }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      节点背景圆形的最小显示半径，确保节点始终可见且易于交互<br />
                      <strong>放大效果：</strong
                      >背景圆形更大，点击区域更大，更容易点击，视觉更突出<br />
                      <strong>缩小效果：</strong
                      >背景圆形更小，点击区域更小，更节省空间，但可能不易点击
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.minBackgroundRadius"
                  :min="80"
                  :max="200"
                  :step="5"
                  label
                  :label-value="`${localParams.minBackgroundRadius}px`"
                  color="teal"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetMinBackgroundRadius" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.minBackgroundRadius }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 缩放 -->
        <q-expansion-item icon="zoom_out_map" label="缩放" class="q-mb-sm">
          <q-card-section>
            <!-- 背景半径缩放因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_out_map" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点数 = 0 时的半径缩放</div>
                      <span class="text-body2 text-teal q-ml-md"
                        >当前: {{ (localParams.radiusScaleNone * 100).toFixed(0) }}%</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      当知识图谱中没有圆周节点时，背景半径的缩放比例<br />
                      <strong>放大效果：</strong
                      >无节点时背景圆形更大，视觉更突出，占用更多空间<br />
                      <strong>缩小效果：</strong>无节点时背景圆形更小，视觉更紧凑，节省空间
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusScaleNone"
                  :min="0.4"
                  :max="1.1"
                  :step="0.01"
                  label
                  :label-value="`${(localParams.radiusScaleNone * 100).toFixed(0)}%`"
                  color="teal"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusScaleNone" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ (defaultParams.radiusScaleNone * 100).toFixed(0) }}%</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_out_map" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点数 ≤ 2 时的半径缩放</div>
                      <span class="text-body2 text-teal q-ml-md"
                        >当前: {{ (localParams.radiusScaleSmall * 100).toFixed(0) }}%</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      当知识图谱中节点数量较少（≤2个）时，背景半径的缩放比例<br />
                      <strong>放大效果：</strong
                      >节点少时背景圆形更大，视觉更突出，占用更多空间<br />
                      <strong>缩小效果：</strong>节点少时背景圆形更小，视觉更紧凑，节省空间
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusScaleSmall"
                  :min="0.5"
                  :max="1.2"
                  :step="0.01"
                  label
                  :label-value="`${(localParams.radiusScaleSmall * 100).toFixed(0)}%`"
                  color="teal"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusScaleSmall" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ (defaultParams.radiusScaleSmall * 100).toFixed(0) }}%</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_out_map" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点数 3-4 时的半径缩放</div>
                      <span class="text-body2 text-teal q-ml-md"
                        >当前: {{ (localParams.radiusScaleMedium * 100).toFixed(0) }}%</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      当知识图谱中节点数量中等（3-4个）时，背景半径的缩放比例<br />
                      <strong>放大效果：</strong>中等节点数时背景圆形更大，视觉更突出<br />
                      <strong>缩小效果：</strong>中等节点数时背景圆形更小，视觉更紧凑
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusScaleMedium"
                  :min="0.6"
                  :max="1.5"
                  :step="0.01"
                  label
                  :label-value="`${(localParams.radiusScaleMedium * 100).toFixed(0)}%`"
                  color="teal"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusScaleMedium" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ (defaultParams.radiusScaleMedium * 100).toFixed(0) }}%</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_out_map" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点数 > 4 时的半径缩放</div>
                      <span class="text-body2 text-teal q-ml-md"
                        >当前: {{ (localParams.radiusScaleLarge * 100).toFixed(0) }}%</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      当知识图谱中节点数量较多（>4个）时，背景半径的缩放比例<br />
                      <strong>放大效果：</strong>节点多时背景圆形更大，视觉更突出但可能拥挤<br />
                      <strong>缩小效果：</strong>节点多时背景圆形更小，避免拥挤，视觉更紧凑
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.radiusScaleLarge"
                  :min="0.7"
                  :max="1.6"
                  :step="0.01"
                  label
                  :label-value="`${(localParams.radiusScaleLarge * 100).toFixed(0)}%`"
                  color="teal"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetRadiusScaleLarge" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ (defaultParams.radiusScaleLarge * 100).toFixed(0) }}%</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 五、节点 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #9c27b0">
          🎯 节点
        </div>

        <!-- 中心节点 -->
        <q-expansion-item icon="adjust" label="中心节点" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 中心节点默认尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="adjust" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">中心节点默认尺寸 (像素)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.centerNodeSizeDefault }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制中心节点在默认状态下的大小<br />
                      <strong>放大效果：</strong>中心节点显示更大，内容更清晰，但占用更多空间<br />
                      <strong>缩小效果：</strong>中心节点显示更小，节省空间，但内容可能看不清
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.centerNodeSizeDefault"
                  :min="100"
                  :max="300"
                  :step="5"
                  label
                  :label-value="`${localParams.centerNodeSizeDefault}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCenterNodeSizeDefault" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.centerNodeSizeDefault }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 中心节点展开尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_in" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">中心节点展开尺寸 (像素)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.centerNodeSizeExpanded }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制中心节点在展开状态下的大小<br />
                      <strong>放大效果：</strong
                      >展开的中心节点更大，内容更突出，但可能遮挡其他元素<br />
                      <strong>缩小效果：</strong>展开的中心节点更小，节省空间，但视觉冲击力减弱
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.centerNodeSizeExpanded"
                  :min="150"
                  :max="400"
                  :step="5"
                  label
                  :label-value="`${localParams.centerNodeSizeExpanded}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCenterNodeSizeExpanded" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.centerNodeSizeExpanded }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 中心节点收缩尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="zoom_out" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">中心节点收缩尺寸 (像素)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.centerNodeSizeShrunk }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制中心节点在其他图谱展开时的缩小大小<br />
                      <strong>放大效果：</strong
                      >缩小后的中心节点更大，仍然较明显，但可能干扰展开的图谱<br />
                      <strong>缩小效果：</strong>缩小后的中心节点更小，更不显眼，突出展开的图谱
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.centerNodeSizeShrunk"
                  :min="80"
                  :max="250"
                  :step="5"
                  label
                  :label-value="`${localParams.centerNodeSizeShrunk}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCenterNodeSizeShrunk" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.centerNodeSizeShrunk }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 中心节点缩放速度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="speed" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">中心节点缩放速度 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.centerNodeScaleSpeed.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制中心节点在大小变化时的缩放动画持续时间<br />
                      <strong>加快效果：</strong
                      >数值越小，缩放动画越快，响应更敏捷，但可能显得突兀<br />
                      <strong>减慢效果：</strong>数值越大，缩放动画越慢，过渡更平滑，但响应较慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.centerNodeScaleSpeed"
                  :min="0.1"
                  :max="2.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.centerNodeScaleSpeed.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCenterNodeScaleSpeed" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.centerNodeScaleSpeed.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 归一化参考高度比例 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="vertical_align_center" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">归一化参考高度比例</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前:
                        {{ (localParams.normalizedReferenceHeightRatio * 100).toFixed(0) }}%</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制滑动距离的归一化参考高度，参考移动端短视频切换方式<br />
                      <strong>放大效果：</strong
                      >需要滑动更少的屏幕高度就能切换到下一个知识图谱，交互更灵敏<br />
                      <strong>缩小效果：</strong
                      >需要滑动更多的屏幕高度才能切换到下一个知识图谱，交互更稳定
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.normalizedReferenceHeightRatio"
                  :min="0.1"
                  :max="1.5"
                  :step="0.01"
                  label
                  :label-value="`${(localParams.normalizedReferenceHeightRatio * 100).toFixed(0)}%`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetNormalizedReferenceHeightRatio"
                  />
                  <span class="text-caption text-grey-6"
                    >默认:
                    {{ (defaultParams.normalizedReferenceHeightRatio * 100).toFixed(0) }}%</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 圆周节点 -->
        <q-expansion-item icon="radio_button_checked" label="圆周节点" class="q-mb-sm">
          <q-card-section>
            <!-- 圆周节点半径因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="radio_button_checked" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点半径因子</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeRadiusFactor.toFixed(2) }}</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      用于调整圆周节点相对背景圆的位置（1.0表示与背景圆一致）<br />
                      <strong>放大效果：</strong
                      >圆周节点距离中心更远，分散范围更大，视觉更开阔<br />
                      <strong>缩小效果：</strong>圆周节点距离中心更近，分散范围更小，视觉更紧凑
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeRadiusFactor"
                  :min="0.5"
                  :max="2.0"
                  :step="0.05"
                  label
                  :label-value="localParams.circularNodeRadiusFactor.toFixed(2)"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeRadiusFactor" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeRadiusFactor.toFixed(2) }}</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- X方向偏移量 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="horizontal_rule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">X方向偏移量 (circularNodeOffsetX)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeOffsetX }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      用于调整圆周节点相对中心的X方向偏移量（像素）<br />
                      <strong>放大效果：</strong
                      >节点在水平方向上偏移更大，可用于微调节点水平对齐位置<br />
                      <strong>缩小效果：</strong
                      >节点在水平方向上偏移更小，可用于精确调整节点水平位置
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeOffsetX"
                  :min="0"
                  :max="200"
                  :step="1"
                  label
                  :label-value="`${localParams.circularNodeOffsetX}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeOffsetX" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeOffsetX }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- Y方向偏移量 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="vertical_align_center" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">Y方向偏移量 (circularNodeOffsetY)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeOffsetY }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      用于调整圆周节点相对中心的Y方向偏移量（像素）<br />
                      <strong>放大效果：</strong
                      >节点在垂直方向上偏移更大，可用于微调节点垂直对齐位置<br />
                      <strong>缩小效果：</strong
                      >节点在垂直方向上偏移更小，可用于精确调整节点垂直位置
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeOffsetY"
                  :min="0"
                  :max="200"
                  :step="1"
                  label
                  :label-value="`${localParams.circularNodeOffsetY}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeOffsetY" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeOffsetY }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 圆周节点字体大小 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="text_fields" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点字体大小</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeFontSize.toFixed(2) }}rem</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      用于调整圆周节点标题的字体大小（rem单位）<br />
                      <strong>放大效果：</strong
                      >字体更大，文本更清晰易读<br />
                      <strong>缩小效果：</strong>字体更小，节省空间，适合显示更多内容
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeFontSize"
                  :min="0.5"
                  :max="2.0"
                  :step="0.05"
                  label
                  :label-value="`${localParams.circularNodeFontSize.toFixed(2)}rem`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeFontSize" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeFontSize.toFixed(2) }}rem</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 圆周节点内容字体大小 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="description" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点内容字体大小</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeContentFontSize.toFixed(2) }}rem</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      用于调整圆周节点内容的字体大小（rem单位）<br />
                      <strong>放大效果：</strong
                      >内容字体更大，文本更清晰易读<br />
                      <strong>缩小效果：</strong>内容字体更小，节省空间，适合显示更多内容
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeContentFontSize"
                  :min="0.5"
                  :max="1.5"
                  :step="0.025"
                  label
                  :label-value="`${localParams.circularNodeContentFontSize.toFixed(2)}rem`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeContentFontSize" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeContentFontSize.toFixed(2) }}rem</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 圆周节点半径大小 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="crop_free" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点半径大小 (像素)</div>
                      <span class="text-body2 text-indigo q-ml-md"
                        >当前: {{ localParams.circularNodeRadius }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制圆周节点本身的半径大小<br />
                      <strong>放大效果：</strong
                      >圆周节点显示更大，内容更清晰，但占用更多空间<br />
                      <strong>缩小效果：</strong>圆周节点显示更小，节省空间，但内容可能看不清
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.circularNodeRadius"
                  :min="50"
                  :max="200"
                  :step="5"
                  label
                  :label-value="`${localParams.circularNodeRadius}px`"
                  color="indigo"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetCircularNodeRadius" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.circularNodeRadius }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 学习标签 -->
        <q-expansion-item icon="label" label="学习标签" class="q-mb-sm">
          <q-card-section>
            <!-- 学习标签位置参数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="place" class="q-mr-sm" />
                  <div class="col">
                    <div class="text-subtitle2">学习标签位置参数</div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制学习标签在节点上的位置<br />
                      <strong>Top：</strong>距离节点顶部的距离（px）<br />
                      <strong>Left：</strong>距离节点左边的距离（px）<br />
                      <strong>TranslateX：</strong>水平偏移量（百分比，负值向左）
                    </div>
                  </div>
                </div>

                <!-- Top位置 -->
                <div class="q-mb-md">
                  <div class="row items-center justify-between q-mb-xs">
                    <span class="text-body2">Top位置 (px)</span>
                    <span class="text-body2 text-purple"
                      >当前:
                      {{
                        typeof localParams.learningTagTop === 'number'
                          ? localParams.learningTagTop.toFixed(0)
                          : localParams.learningTagTop
                      }}px</span
                    >
                  </div>
                  <q-slider
                    v-model="learningTagTopNumber"
                    :min="-50"
                    :max="50"
                    :step="1"
                    label
                    :label-value="`${learningTagTopNumber.toFixed(0)}px`"
                    color="purple"
                  />
                </div>

                <!-- Left位置 -->
                <div class="q-mb-md">
                  <div class="row items-center justify-between q-mb-xs">
                    <span class="text-body2">Left位置 (px)</span>
                    <span class="text-body2 text-purple"
                      >当前:
                      {{
                        typeof localParams.learningTagLeft === 'number'
                          ? localParams.learningTagLeft.toFixed(0)
                          : localParams.learningTagLeft
                      }}px</span
                    >
                  </div>
                  <q-slider
                    v-model="learningTagLeftNumber"
                    :min="-250"
                    :max="250"
                    :step="1"
                    label
                    :label-value="`${learningTagLeftNumber.toFixed(0)}px`"
                    color="purple"
                  />
                </div>

                <!-- TranslateX偏移 -->
                <div class="q-mb-sm">
                  <div class="row items-center justify-between q-mb-xs">
                    <span class="text-body2">TranslateX偏移 (%)</span>
                    <span class="text-body2 text-purple"
                      >当前:
                      {{
                        typeof localParams.learningTagTranslateX === 'number'
                          ? localParams.learningTagTranslateX.toFixed(1)
                          : localParams.learningTagTranslateX ?? '0'
                      }}%</span
                    >
                  </div>
                  <q-slider
                    v-model="localParams.learningTagTranslateX"
                    :min="-100"
                    :max="100"
                    :step="1"
                    label
                    :label-value="`${(localParams.learningTagTranslateX ?? 0).toFixed(1)}%`"
                    color="purple"
                    @update:model-value="updateParams"
                  />
                </div>

                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetLearningTagPosition" />
                  <span class="text-caption text-grey-6">
                    默认: Top
                    {{
                      typeof defaultParams.learningTagTop === 'number'
                        ? defaultParams.learningTagTop.toFixed(0)
                        : defaultParams.learningTagTop
                    }}px, Left
                    {{
                      typeof defaultParams.learningTagLeft === 'number'
                        ? defaultParams.learningTagLeft.toFixed(0)
                        : defaultParams.learningTagLeft
                    }}px, TranslateX
                    {{
                      typeof defaultParams.learningTagTranslateX === 'number'
                        ? defaultParams.learningTagTranslateX.toFixed(1)
                        : defaultParams.learningTagTranslateX ?? '0'
                    }}%
                  </span>
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 六、动画 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #c2185b">
          ✨ 动画效果
        </div>

        <!-- 基础动画 -->
        <q-expansion-item icon="animation" label="基础动画" default-opened class="q-mb-sm">
          <q-card-section>
            <!-- 位置变换动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="timeline" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">位置变换动画持续时间 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前: {{ localParams.transformDuration.toFixed(1) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制节点位置变换动画的持续时间<br />
                      <strong>放大效果：</strong
                      >位置变化动画更慢，过渡更平滑但可能感觉拖沓，适合慢节奏体验<br />
                      <strong>缩小效果：</strong
                      >位置变化动画更快，过渡更干脆但可能感觉生硬，适合快节奏体验
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.transformDuration"
                  :min="0.1"
                  :max="2.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.transformDuration.toFixed(1)}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetTransformDuration" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.transformDuration.toFixed(1) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 透明度动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="opacity" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">透明度动画持续时间 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前: {{ localParams.opacityDuration.toFixed(1) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制节点透明度变化的动画持续时间<br />
                      <strong>放大效果：</strong
                      >透明度变化动画更慢，淡入淡出效果更柔和，过渡更平滑<br />
                      <strong>缩小效果：</strong>透明度变化动画更快，淡入淡出效果更快速，过渡更干脆
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.opacityDuration"
                  :min="0.1"
                  :max="2.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.opacityDuration.toFixed(1)}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetOpacityDuration" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.opacityDuration.toFixed(1) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 缓动函数参数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="tune" class="q-mr-sm" />
                  <div class="col">
                    <div class="text-subtitle2">缓动函数 (cubic-bezier)</div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制动画的缓动效果，选择经典的缓动函数预设<br />
                      <strong>线性：</strong>匀速动画<br />
                      <strong>缓入：</strong>慢速开始，加速结束<br />
                      <strong>缓出：</strong>快速开始，减速结束<br />
                      <strong>缓进缓出：</strong>慢速开始和结束，中间加速（推荐）
                    </div>
                  </div>
                </div>

                <!-- 缓动函数选择 -->
                <div class="q-mb-sm">
                  <q-select
                    v-model="selectedEasingFunction"
                    :options="easingFunctionOptionsWithCustom"
                    option-label="label"
                    option-value="id"
                    behavior="menu"
                    emit-value
                    map-options
                    outlined
                    dense
                    @update:model-value="applyEasingFunction"
                  >
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption>
                            cubic-bezier({{ scope.opt.x1.toFixed(2) }},
                            {{ scope.opt.y1.toFixed(2) }}, {{ scope.opt.x2.toFixed(2) }},
                            {{ scope.opt.y2.toFixed(2) }})
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </div>

                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetEasing" />
                  <span class="text-caption text-grey-6">
                    当前: cubic-bezier({{ localParams.easingX1.toFixed(2) }},
                    {{ localParams.easingY1.toFixed(2) }}, {{ localParams.easingX2.toFixed(2) }},
                    {{ localParams.easingY2.toFixed(2) }})
                  </span>
                </div>
              </q-card-section>
            </q-card>

            <!-- 动画延迟系数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="schedule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">动画延迟系数 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前: {{ localParams.animationDelayFactor.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制基于距离的动画延迟计算系数，值越大延迟越长<br />
                      <strong>放大效果：</strong
                      >距离越远的节点动画延迟越长，产生波浪式展开效果，视觉更动感但可能感觉慢<br />
                      <strong>缩小效果：</strong
                      >距离对延迟影响更小，所有节点几乎同时动画，展开更统一但动感较弱
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.animationDelayFactor"
                  :min="0"
                  :max="0.2"
                  :step="0.01"
                  label
                  :label-value="`${localParams.animationDelayFactor.toFixed(2)}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetAnimationDelayFactor" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.animationDelayFactor.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 背景动画 -->
        <q-expansion-item icon="rotate_right" label="背景动画" class="q-mb-sm">
          <q-card-section>
            <!-- 背景圆形过渡时间（顺时针） -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="rotate_right" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">背景圆形过渡时间 - 顺时针 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前:
                        {{ localParams.backgroundTransitionDurationClockwise.toFixed(1) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      顺时针旋转时背景圆形的收缩速度<br />
                      <strong>放大效果：</strong
                      >顺时针旋转时背景圆形收缩更慢，过渡更平滑，视觉更柔和<br />
                      <strong>缩小效果：</strong
                      >顺时针旋转时背景圆形收缩更快，过渡更干脆，响应更迅速
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.backgroundTransitionDurationClockwise"
                  :min="0.1"
                  :max="1.5"
                  :step="0.1"
                  label
                  :label-value="`${localParams.backgroundTransitionDurationClockwise.toFixed(1)}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetBackgroundTransitionDurationClockwise"
                  />
                  <span class="text-caption text-grey-6"
                    >默认:
                    {{ defaultParams.backgroundTransitionDurationClockwise.toFixed(1) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 背景圆形过渡时间（逆时针） -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="rotate_left" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">背景圆形过渡时间 - 逆时针 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前:
                        {{
                          localParams.backgroundTransitionDurationCounterclockwise.toFixed(1)
                        }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      逆时针旋转时背景圆形的收缩速度<br />
                      <strong>放大效果：</strong
                      >逆时针旋转时背景圆形收缩更慢，过渡更平滑，视觉更柔和<br />
                      <strong>缩小效果：</strong
                      >逆时针旋转时背景圆形收缩更快，过渡更干脆，响应更迅速
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.backgroundTransitionDurationCounterclockwise"
                  :min="0.1"
                  :max="1.5"
                  :step="0.1"
                  label
                  :label-value="`${localParams.backgroundTransitionDurationCounterclockwise.toFixed(1)}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetBackgroundTransitionDurationCounterclockwise"
                  />
                  <span class="text-caption text-grey-6"
                    >默认:
                    {{
                      defaultParams.backgroundTransitionDurationCounterclockwise.toFixed(1)
                    }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 展开动画 -->
        <q-expansion-item icon="timer" label="展开动画" class="q-mb-sm">
          <q-card-section>
            <!-- 展开旋转动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="rotate_right" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">展开旋转动画持续时间 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前: {{ localParams.expandingRotationDuration }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      展开知识图谱时的旋转动画持续时间<br />
                      <strong>放大效果：</strong
                      >展开旋转动画更慢，旋转到目标位置需要更长时间，过渡更平滑但可能感觉慢<br />
                      <strong>缩小效果：</strong
                      >展开旋转动画更快，旋转到目标位置更快，响应更迅速但可能感觉生硬
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.expandingRotationDuration"
                  :min="0.1"
                  :max="2"
                  :step="0.05"
                  label
                  :label-value="`${localParams.expandingRotationDuration}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetExpandingRotationDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.expandingRotationDuration }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 防抖延迟 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="schedule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">防抖延迟 (秒)</div>
                      <span class="text-body2 text-pink q-ml-md"
                        >当前: {{ localParams.debounceDelay }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      避免与点击事件冲突的防抖延迟时间<br />
                      <strong>放大效果：</strong
                      >防抖延迟更长，拖拽后需要等待更长时间才能点击，避免误触但响应更慢<br />
                      <strong>缩小效果：</strong
                      >防抖延迟更短，拖拽后很快就能点击，响应更快但可能误触
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.debounceDelay"
                  :min="0"
                  :max="0.5"
                  :step="0.01"
                  label
                  :label-value="`${localParams.debounceDelay}s`"
                  color="pink"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetDebounceDelay" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.debounceDelay }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 节点动画参数 -->
        <q-expansion-item icon="play_circle" label="节点动画参数" class="q-mb-sm">
          <q-card-section>
            <!-- 节点进入/退出动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="play_circle" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点进入/退出动画持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeEnterExitDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制圆周节点进入和退出动画的持续时间<br />
                      <strong>加快效果：</strong>数值越小，节点出现/消失动画越快，响应更敏捷<br />
                      <strong>减慢效果：</strong>数值越大，节点出现/消失动画越慢，过渡更平滑
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeEnterExitDuration"
                  :min="0.1"
                  :max="2.0"
                  :step="0.05"
                  label
                  :label-value="`${localParams.nodeEnterExitDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetNodeEnterExitDuration" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeEnterExitDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 圆周节点展开动画延迟间隔 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="schedule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点展开动画延迟间隔 (秒/索引)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeExpandDelayInterval.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制圆周节点展开时每个节点之间的延迟间隔，延迟时间 = 索引 × 间隔<br />
                      <strong>加快效果：</strong>数值越小，节点依次出现的间隔越短，动画更快速<br />
                      <strong>减慢效果：</strong>数值越大，节点依次出现的间隔越长，动画更渐进
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeExpandDelayInterval"
                  :min="0.01"
                  :max="0.3"
                  :step="0.01"
                  label
                  :label-value="`${localParams.nodeExpandDelayInterval.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetNodeExpandDelayInterval" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeExpandDelayInterval.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 圆周节点收起动画延迟间隔 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="schedule" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">圆周节点收起动画延迟间隔 (秒/索引)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeCollapseDelayInterval.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制圆周节点收起时每个节点之间的延迟间隔，延迟时间 = 索引 × 间隔<br />
                      <strong>加快效果：</strong>数值越小，节点依次消失的间隔越短，动画更快速<br />
                      <strong>减慢效果：</strong>数值越大，节点依次消失的间隔越长，动画更渐进
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeCollapseDelayInterval"
                  :min="0.01"
                  :max="0.2"
                  :step="0.01"
                  label
                  :label-value="`${localParams.nodeCollapseDelayInterval.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetNodeCollapseDelayInterval"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeCollapseDelayInterval.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 节点内容transition持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="text_fields" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点内容transition持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeContentTransitionDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制节点内容（标题、章节名等）的transition动画持续时间<br />
                      <strong>加快效果：</strong>数值越小，内容变化动画越快<br />
                      <strong>减慢效果：</strong>数值越大，内容变化动画越慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeContentTransitionDuration"
                  :min="0.1"
                  :max="2.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.nodeContentTransitionDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetNodeContentTransitionDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeContentTransitionDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 节点基础transition持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="circle" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点基础transition持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeBaseTransitionDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制节点基础状态的transition动画持续时间<br />
                      <strong>加快效果：</strong>数值越小，节点状态变化动画越快<br />
                      <strong>减慢效果：</strong>数值越大，节点状态变化动画越慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeBaseTransitionDuration"
                  :min="0.1"
                  :max="1.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.nodeBaseTransitionDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetNodeBaseTransitionDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeBaseTransitionDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 学习标签transition持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="label" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">学习标签transition持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.learningTagTransitionDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制学习标签的transition动画持续时间<br />
                      <strong>加快效果：</strong>数值越小，标签变化动画越快<br />
                      <strong>减慢效果：</strong>数值越大，标签变化动画越慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.learningTagTransitionDuration"
                  :min="0.1"
                  :max="2.0"
                  :step="0.1"
                  label
                  :label-value="`${localParams.learningTagTransitionDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetLearningTagTransitionDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.learningTagTransitionDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 气泡框按钮transition持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="radio_button_checked" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">气泡框按钮transition持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.bubbleButtonTransitionDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制气泡框按钮的transition动画持续时间<br />
                      <strong>加快效果：</strong>数值越小，按钮交互动画越快<br />
                      <strong>减慢效果：</strong>数值越大，按钮交互动画越慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.bubbleButtonTransitionDuration"
                  :min="0.05"
                  :max="0.5"
                  :step="0.05"
                  label
                  :label-value="`${localParams.bubbleButtonTransitionDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetBubbleButtonTransitionDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.bubbleButtonTransitionDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 节点active状态transition持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="touch_app" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">节点active状态transition持续时间 (秒)</div>
                      <span class="text-body2 text-purple q-ml-md"
                        >当前: {{ localParams.nodeActiveTransitionDuration.toFixed(2) }}s</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      控制节点点击时的缩放动画持续时间<br />
                      <strong>加快效果：</strong>数值越小，点击反馈动画越快<br />
                      <strong>减慢效果：</strong>数值越大，点击反馈动画越慢
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.nodeActiveTransitionDuration"
                  :min="0.05"
                  :max="0.3"
                  :step="0.05"
                  label
                  :label-value="`${localParams.nodeActiveTransitionDuration.toFixed(2)}s`"
                  color="purple"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    label="重置"
                    @click="resetNodeActiveTransitionDuration"
                  />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.nodeActiveTransitionDuration.toFixed(2) }}s</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 七、尺寸 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #1976d2">
          📐 尺寸
        </div>

        <!-- 尺寸参数 -->
        <q-expansion-item icon="crop_free" label="图形尺寸参数" class="q-mb-sm">
          <q-card-section>
            <!-- 图形尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="crop_free" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">图形尺寸 (像素)</div>
                      <span class="text-body2 text-primary q-ml-md"
                        >当前: {{ localParams.graphSize }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      知识图谱的宽度和高度（像素）<br />
                      <strong>放大效果：</strong
                      >图谱显示更大，内容更清晰，但占用更多屏幕空间，可能与其他元素重叠<br />
                      <strong>缩小效果：</strong
                      >图谱显示更小，节省屏幕空间，但内容可能看不清，需要放大查看
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.graphSize"
                  :min="200"
                  :max="800"
                  :step="10"
                  label
                  :label-value="`${localParams.graphSize}px`"
                  color="primary"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetGraphSize" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.graphSize }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>

            <!-- 图形位置偏移 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon name="center_focus_strong" class="q-mr-sm" />
                  <div class="col">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle2">图形位置偏移 (像素)</div>
                      <span class="text-body2 text-primary q-ml-md"
                        >当前: {{ localParams.graphMargin }}px</span
                      >
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      图形位置偏移量，用于居中定位（负值）
                    </div>
                  </div>
                </div>
                <q-slider
                  v-model="localParams.graphMargin"
                  :min="100"
                  :max="500"
                  :step="10"
                  label
                  :label-value="`${localParams.graphMargin}px`"
                  color="primary"
                  @update:model-value="updateParams"
                />
                <div class="row justify-between q-mt-xs">
                  <q-btn flat dense size="sm" label="重置" @click="resetGraphMargin" />
                  <span class="text-caption text-grey-6"
                    >默认: {{ defaultParams.graphMargin }}px</span
                  >
                </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>
      </q-card-section>

      <!-- ========== 节点管理 ========== -->
      <q-separator class="q-my-md" />
      <div class="text-subtitle2 text-weight-bold q-mb-sm" style="color: #f57c00">🔧 节点管理</div>

      <!-- 节点管理区域 -->
      <q-expansion-item icon="account_tree" label="知识图谱节点控制" default-opened class="q-mb-sm">
        <q-card-section>
          <!-- 树形节点控制 -->
          <q-card flat bordered class="q-mb-md parameter-card">
            <q-card-section>
              <div class="row items-center justify-between q-mb-sm">
                <div class="text-subtitle2">
                  <q-icon name="account_tree" class="q-mr-sm" />
                  节点树形结构
                </div>
                <q-btn
                  v-if="centerNode"
                  flat
                  dense
                  size="sm"
                  color="positive"
                  icon="add"
                  label="添加子节点"
                  @click="showAddCircularNodeDialog = true"
                />
              </div>
              <div v-if="treeData.length > 0" class="q-mt-md">
                <q-tree
                  :nodes="treeData"
                  node-key="id"
                  :expanded="expandedNodes"
                  @update:expanded="
                    (val) => {
                      expandedNodes = [...val]
                    }
                  "
                  :selected="selectedNode"
                  @update:selected="
                    (val) => {
                      selectedNode = val
                    }
                  "
                  default-expand-all
                >
                  <template v-slot:default-header="prop">
                    <div class="row items-center full-width" style="gap: 8px">
                      <q-icon
                        :name="prop.node.nodeType === 'center' ? 'adjust' : 'radio_button_checked'"
                        :color="prop.node.nodeType === 'center' ? 'primary' : 'secondary'"
                        size="sm"
                        class="q-mr-xs"
                      />
                      <div class="col">
                        <div class="text-body2 text-weight-medium">
                          {{ prop.node.label }}
                        </div>
                        <div class="text-caption text-grey-6">
                          ID: {{ prop.node.id }} | 层级: {{ prop.node.level ?? 'N/A' }}
                        </div>
                      </div>
                      <div class="row q-gutter-xs">
                        <q-btn
                          v-if="prop.node.nodeType !== 'center'"
                          flat
                          round
                          dense
                          size="xs"
                          color="positive"
                          icon="add"
                          @click.stop="handleAddChildNode(prop.node)"
                          title="添加子节点"
                        />
                        <q-btn
                          flat
                          round
                          dense
                          size="xs"
                          color="primary"
                          icon="edit"
                          @click.stop="handleEditNodeFromTree(prop.node)"
                          title="编辑节点"
                        />
                        <q-btn
                          flat
                          round
                          dense
                          size="xs"
                          color="negative"
                          icon="delete"
                          @click.stop="handleDeleteNodeFromTree(prop.node)"
                          title="删除节点"
                        />
                      </div>
                    </div>
                  </template>
                </q-tree>
              </div>
              <div v-else class="text-body2 text-grey-6 q-mt-md text-center q-pa-md">
                暂无节点数据，请先选择章节
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>
      </q-expansion-item>
    </q-card>
  </div>

  <!-- 添加圆周节点对话框 -->
  <q-dialog v-model="showAddCircularNodeDialog">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">添加子节点</div>
      </q-card-section>
      <q-card-section>
        <div v-if="newNodeParentId" class="text-caption text-grey-7 q-mb-md">
          父节点: {{ getNodeNameById(newNodeParentId) }}
        </div>
        <q-input
          v-model="newNodeName"
          label="节点名称"
          outlined
          dense
          :rules="[(val) => !!val || '请输入节点名称']"
          class="q-mb-md"
        />
        <q-input
          v-model="newNodeId"
          label="节点ID（可选，留空自动生成）"
          outlined
          dense
          class="q-mb-md"
        />
        <q-input
          v-model.number="newNodeLevel"
          type="number"
          label="层级"
          outlined
          dense
          :rules="[(val) => (val !== null && val !== undefined) || '请输入层级']"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup @click="newNodeParentId = null" />
        <q-btn flat label="确定" color="primary" @click="handleAddCircularNode" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- 编辑圆周节点对话框 -->
  <q-dialog v-model="showEditCircularNodeDialog">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">编辑圆周节点</div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="editingNode.name"
          label="节点名称"
          outlined
          dense
          :rules="[(val) => !!val || '请输入节点名称']"
          class="q-mb-md"
        />
        <q-input v-model="editingNode.id" label="节点ID" outlined dense readonly class="q-mb-md" />
        <q-input
          v-model.number="editingNode.level"
          type="number"
          label="层级"
          outlined
          dense
          :rules="[(val) => (val !== null && val !== undefined) || '请输入层级']"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="确定" color="primary" @click="handleUpdateCircularNode" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- 编辑中心节点对话框 -->
  <q-dialog v-model="showEditCenterNodeDialog">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">编辑中心节点</div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="editingCenterNode.name"
          label="节点名称"
          outlined
          dense
          :rules="[(val) => !!val || '请输入节点名称']"
          class="q-mb-md"
        />
        <q-input
          v-model="editingCenterNode.id"
          label="节点ID"
          outlined
          dense
          readonly
          class="q-mb-md"
        />
        <q-input
          v-model.number="editingCenterNode.level"
          type="number"
          label="层级"
          outlined
          dense
          :rules="[(val) => (val !== null && val !== undefined) || '请输入层级']"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="确定" color="primary" @click="handleUpdateCenterNode" />
      </q-card-actions>
    </q-card>
  </q-dialog>

    <!-- 删除确认对话框 -->
    <q-dialog v-model="showDeleteCenterNodeDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">确认删除</div>
        </q-card-section>
        <q-card-section>
          <div class="text-body1">
            确定要删除中心节点 "{{ centerNode?.name }}" 吗？此操作不可撤销。
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" color="primary" v-close-popup />
          <q-btn flat label="删除" color="negative" @click="handleDeleteCenterNode" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getCurrentUserIdOrDefault } from '../../services'

// 定义参数接口
/**
 * 知识图谱调试参数接口
 *
 * 参数按照以下一级分类组织：
 * 1. 轨迹与位置 - 椭圆轨迹和交互参数
 * 2. 角度与交互 - 角度参数和缩放因子
 * 3. 透明度 - 状态透明度和距离相关透明度
 * 4. 背景圆形 - 尺寸和缩放参数
 * 5. 节点 - 中心节点和圆周节点参数
 * 6. 动画 - 基础动画、背景动画、展开动画和节点动画
 * 7. 尺寸 - 图形尺寸参数
 */
export interface KnowledgeGraphDebugParams {
  // ========== 一级分类：轨迹与位置 ==========
  // 二级分类：椭圆轨迹
  radiusX: number // X轴半径（像素），控制椭圆轨迹的水平半径
  radiusY: number // Y轴半径（像素），控制椭圆轨迹的垂直半径
  // 二级分类：交互
  dragThreshold: number // 拖拽阈值（像素），判断是否为拖拽操作的最小移动距离

  // ========== 一级分类：角度与交互 ==========
  // 二级分类：角度参数
  targetAngle: number // 目标角度（度），知识图谱展开时的目标角度位置，0-360度（0°=正右方，90°=正下方）
  influenceRange: number // 影响范围（弧度），展开图谱周围的影响范围，在此范围内的其他节点会被推开
  maxPushAngle: number // 最大推开角度（弧度），其他节点被推开的最大角度，距离越近推得越远
  scaleFactor: number // 缩放因子，控制距离相关的缩放幅度

  // ========== 一级分类：透明度 ==========
  // 二级分类：状态透明度
  opacityExpanded: number // 展开的知识图谱透明度（0-1）
  opacityDefault: number // 默认状态下透明度（0-1）
  // 二级分类：距离相关透明度
  opacityNearMin: number // 距离相关透明度最小值（0-1），距离展开图谱较近的节点的最小透明度
  opacityNearFactor: number // 距离相关透明度因子（0-1），控制距离对透明度的影响程度
  opacityFar: number // 距离较远节点透明度（0-1）

  // ========== 一级分类：背景圆形 ==========
  // 二级分类：尺寸
  minBackgroundRadius: number // 最小背景半径（像素），节点背景圆形的最小显示半径
  // 二级分类：缩放
  radiusScaleNone: number // 无节点半径缩放因子，节点数 = 0 时的半径缩放比例
  radiusScaleSmall: number // 小规模节点半径缩放因子，节点数 ≤ 2 时的半径缩放比例
  radiusScaleMedium: number // 中等规模节点半径缩放因子，节点数 3-4 时的半径缩放比例
  radiusScaleLarge: number // 大规模节点半径缩放因子，节点数 > 4 时的半径缩放比例

  // ========== 一级分类：节点 ==========
  // 二级分类：中心节点
  centerNodeSizeDefault: number // 中心节点默认尺寸（像素），控制中心节点在默认状态下的大小
  centerNodeSizeExpanded: number // 中心节点展开尺寸（像素），控制中心节点在展开状态下的大小
  centerNodeSizeShrunk: number // 中心节点收缩尺寸（像素），控制中心节点在其他图谱展开时的缩小大小
  centerNodeScaleSpeed: number // 中心节点缩放速度（秒），控制中心节点在大小变化时的缩放动画持续时间
  normalizedReferenceHeightRatio: number // 归一化参考高度比例（0-1），参考移动端短视频切换，使用视口高度的比例作为参考
  // 二级分类：圆周节点
  circularNodeRadiusFactor: number // 圆周节点半径因子，用于调整圆周节点相对背景圆的位置（1.0表示与背景圆一致）
  circularNodeOffsetX: number // 圆周节点X方向偏移量（像素），用于调整节点相对中心的X偏移
  circularNodeOffsetY: number // 圆周节点Y方向偏移量（像素），用于调整节点相对中心的Y偏移
  circularNodeFontSize: number // 圆周节点字体大小（rem），用于调整圆周节点标题的字体大小
  circularNodeContentFontSize: number // 圆周节点内容字体大小（rem），用于调整圆周节点内容的字体大小
  circularNodeRadius: number // 圆周节点半径大小（像素），控制圆周节点本身的半径大小

  // ========== 一级分类：动画 ==========
  // 二级分类：基础动画
  transformDuration: number // 变换动画持续时间（秒）
  opacityDuration: number // 透明度动画持续时间（秒）
  easingX1: number // 缓动函数参数 X1（贝塞尔曲线第一个控制点的X坐标）
  easingY1: number // 缓动函数参数 Y1（贝塞尔曲线第一个控制点的Y坐标）
  easingX2: number // 缓动函数参数 X2（贝塞尔曲线第二个控制点的X坐标）
  easingY2: number // 缓动函数参数 Y2（贝塞尔曲线第二个控制点的Y坐标）
  animationDelayFactor: number // 动画延迟因子（秒），控制动画延迟时间的计算因子
  // 二级分类：背景动画
  backgroundTransitionDurationClockwise: number // 顺时针背景过渡持续时间（秒）
  backgroundTransitionDurationCounterclockwise: number // 逆时针背景过渡持续时间（秒）
  // 二级分类：展开动画
  expandingRotationDuration: number // 展开旋转动画持续时间（秒），展开知识图谱时的旋转动画持续时间
  debounceDelay: number // 防抖延迟（秒），避免与点击事件冲突的防抖延迟时间
  // 二级分类：节点动画
  nodeEnterExitDuration: number // 节点进入/退出动画持续时间（秒）
  nodeExpandDelayInterval: number // 圆周节点展开动画延迟间隔（秒/节点索引）
  nodeCollapseDelayInterval: number // 圆周节点收起动画延迟间隔（秒/节点索引）
  nodeContentTransitionDuration: number // 节点内容transition持续时间（秒）
  nodeBaseTransitionDuration: number // 节点基础transition持续时间（秒）
  learningTagTransitionDuration: number // 学习标签transition持续时间（秒）
  learningTagTop: number | string // 学习标签top位置（px或字符串）
  learningTagLeft: number | string // 学习标签left位置（px或字符串）
  learningTagTranslateX: number // 学习标签translateX偏移（百分比）
  bubbleButtonTransitionDuration: number // 气泡框按钮transition持续时间（秒）
  nodeActiveTransitionDuration: number // 节点active状态transition持续时间（秒）

  // ========== 一级分类：尺寸 ==========
  // 二级分类：图形尺寸
  graphSize: number // 图形尺寸（像素）
  graphMargin: number // 图形位置偏移（像素）
}

// Props
interface Props {
  modelValue: boolean
  params?: Partial<KnowledgeGraphDebugParams>
  defaultParams?: KnowledgeGraphDebugParams
  currentChapter?: ChapterNode | null
}

// 使用完整的节点接口，兼容 types/textbook.ts 中的 ChapterNode
interface ChapterNode {
  id: string
  name: string
  label: string
  level: number | null
  isRoot: boolean
  updateTime: string
  parentId?: string | null
  knowledgeList?: string
  children?: ChapterNode[]
}

const props = withDefaults(defineProps<Props>(), {
  params: () => ({}),
  defaultParams: () =>
    ({
      radiusX: 500,
      radiusY: 320,
      dragThreshold: 3,
      minBackgroundRadius: 120,
      radiusScaleNone: 0.7,
      radiusScaleSmall: 0.8,
      radiusScaleMedium: 1.0,
      radiusScaleLarge: 0.95,
      transformDuration: 0.8,
      opacityDuration: 0.8,
      easingX1: 0.25,
      easingY1: 0.46,
      easingX2: 0.45,
      easingY2: 0.94,
      animationDelayFactor: 0.03,
      backgroundTransitionDurationClockwise: 0.6,
      backgroundTransitionDurationCounterclockwise: 0.6,
      targetAngle: 150,
      influenceRange: (2 * Math.PI) / 3,
      maxPushAngle: (46 * Math.PI) / 180,
      expandingRotationDuration: 0.8,
      debounceDelay: 0.1,
      opacityExpanded: 0.9,
      opacityNearMin: 0.5,
      opacityNearFactor: 0.1,
      opacityFar: 0.4,
      opacityDefault: 0.8,
      scaleFactor: 0,
      graphSize: 475,
      graphMargin: 237,
      centerNodeSizeDefault: 180,
      centerNodeSizeExpanded: 240,
      centerNodeSizeShrunk: 140,
      centerNodeScaleSpeed: 0.5, // 中心节点缩放速度，默认 0.5 秒
      normalizedReferenceHeightRatio: 0.8,
      // 节点动画参数默认值
      nodeEnterExitDuration: 0.6, // 节点进入/退出动画持续时间，默认 0.6 秒
      nodeExpandDelayInterval: 0.01, // 圆周节点展开动画延迟间隔，默认 0.01 秒/节点索引
      nodeCollapseDelayInterval: 0.01, // 圆周节点收起动画延迟间隔，默认 0.01 秒/节点索引
      nodeContentTransitionDuration: 0.3, // 节点内容transition持续时间，默认 0.6 秒
      nodeBaseTransitionDuration: 0.3, // 节点基础transition持续时间，默认 0.3 秒
      learningTagTransitionDuration: 0.3, // 学习标签transition持续时间，默认 0.6 秒
      learningTagTop: 0, // 学习标签top位置，默认 0px
      learningTagLeft: 50, // 学习标签left位置，默认 50px
      learningTagTranslateX: 0, // 学习标签translateX偏移，默认 0%
      bubbleButtonTransitionDuration: 0.2, // 气泡框按钮transition持续时间，默认 0.2 秒
      nodeActiveTransitionDuration: 0.1, // 节点active状态transition持续时间，默认 0.1 秒
      // 圆周节点位置参数默认值
      circularNodeRadiusFactor: 1.0, // 圆周节点半径因子，默认 1.0 表示与背景圆一致
      circularNodeOffsetX: 21, // 圆周节点X方向偏移量，默认 21 像素
      circularNodeOffsetY: 25, // 圆周节点Y方向偏移量，默认 25 像素
      circularNodeFontSize: 1.2, // 圆周节点字体大小，默认 1.2rem
      circularNodeContentFontSize: 0.875, // 圆周节点内容字体大小，默认 0.875rem
      circularNodeRadius: 100, // 圆周节点半径大小，默认 100 像素
    }) as KnowledgeGraphDebugParams,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:params': [params: KnowledgeGraphDebugParams]
  'update:nodes': [
    action: 'add' | 'update' | 'delete',
    nodeType: 'center' | 'circular',
    node: ChapterNode,
    oldNode?: ChapterNode,
  ]
}>()

// 使用传入的默认参数值
const defaultParams = computed(() => props.defaultParams)

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 初始化本地参数，使用展开运算符创建新对象避免引用共享
const localParams = ref<KnowledgeGraphDebugParams>({
  ...defaultParams.value,
  ...props.params,
})

// 控制参数显示区域的显示/隐藏
const showParamsDisplay = ref(true)

// 经典的缓动函数预设
interface EasingFunction {
  id: string
  label: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const easingFunctionOptions: (
  | EasingFunction
  | { id: string; label: string; x1: number; y1: number; x2: number; y2: number }
)[] = [
  {
    id: 'default',
    label: '缓进缓出（默认）',
    x1: 0.25,
    y1: 0.46,
    x2: 0.45,
    y2: 0.94,
  },
  {
    id: 'ease',
    label: '缓动（ease）',
    x1: 0.25,
    y1: 0.1,
    x2: 0.25,
    y2: 1,
  },
  {
    id: 'ease-in',
    label: '缓入（ease-in）',
    x1: 0.42,
    y1: 0,
    x2: 1,
    y2: 1,
  },
  {
    id: 'ease-out',
    label: '缓出（ease-out）',
    x1: 0,
    y1: 0,
    x2: 0.58,
    y2: 1,
  },
  {
    id: 'ease-in-out',
    label: '缓入缓出（ease-in-out）',
    x1: 0.42,
    y1: 0,
    x2: 0.58,
    y2: 1,
  },
  {
    id: 'linear',
    label: '线性（linear）',
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 1,
  },
]

// 根据当前缓动函数参数查找对应的预设ID
const findEasingFunctionId = (x1: number, y1: number, x2: number, y2: number): string => {
  const epsilon = 0.01 // 允许的误差范围
  for (const option of easingFunctionOptions) {
    if (
      Math.abs(option.x1 - x1) < epsilon &&
      Math.abs(option.y1 - y1) < epsilon &&
      Math.abs(option.x2 - x2) < epsilon &&
      Math.abs(option.y2 - y2) < epsilon
    ) {
      return option.id
    }
  }
  return 'custom'
}

// 当前选中的缓动函数ID
const selectedEasingFunction = computed({
  get: () => {
    return findEasingFunctionId(
      localParams.value.easingX1,
      localParams.value.easingY1,
      localParams.value.easingX2,
      localParams.value.easingY2,
    )
  },
  set: () => {
    // 这里不会被直接调用，通过 applyEasingFunction 方法设置
  },
})

// 包含自定义选项的缓动函数列表
const easingFunctionOptionsWithCustom = computed(() => {
  const currentId = selectedEasingFunction.value
  if (currentId === 'custom') {
    // 如果当前是自定义值，添加一个自定义选项
    return [
      ...easingFunctionOptions,
      {
        id: 'custom',
        label: '自定义',
        x1: localParams.value.easingX1,
        y1: localParams.value.easingY1,
        x2: localParams.value.easingX2,
        y2: localParams.value.easingY2,
      },
    ]
  }
  return easingFunctionOptions
})

// 应用选中的缓动函数
const applyEasingFunction = (functionId: string) => {
  // 如果选择的是自定义，不改变当前值
  if (functionId === 'custom') {
    return
  }
  const easingFunction = easingFunctionOptions.find((opt) => opt.id === functionId)
  if (easingFunction) {
    localParams.value.easingX1 = easingFunction.x1
    localParams.value.easingY1 = easingFunction.y1
    localParams.value.easingX2 = easingFunction.x2
    localParams.value.easingY2 = easingFunction.y2
    updateParams()
  }
}

// 学习标签位置参数的计算属性，处理类型转换
const learningTagTopNumber = computed({
  get: () => {
    const value = localParams.value.learningTagTop
    return typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) || 0 : 0
  },
  set: (val: number) => {
    localParams.value.learningTagTop = val
    updateParams()
  },
})

const learningTagLeftNumber = computed({
  get: () => {
    const value = localParams.value.learningTagLeft
    return typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) || 0 : 0
  },
  set: (val: number) => {
    localParams.value.learningTagLeft = val
    updateParams()
  },
})

// 计算修改过的参数
const modifiedParams = computed(() => {
  const modified: Array<{
    key: string
    label: string
    value: number | string | boolean
    formatted: string
  }> = []
  const def = defaultParams.value
  const local = localParams.value

  // 参数标签映射
  const paramLabels: Record<string, string> = {
    radiusX: 'radiusX',
    radiusY: 'radiusY',
    dragThreshold: 'dragThreshold',
    minBackgroundRadius: 'minBackgroundRadius',
    radiusScaleNone: 'radiusScaleNone',
    radiusScaleSmall: 'radiusScaleSmall',
    radiusScaleMedium: 'radiusScaleMedium',
    radiusScaleLarge: 'radiusScaleLarge',
    transformDuration: 'transformDuration',
    opacityDuration: 'opacityDuration',
    easingX1: 'easingX1',
    easingY1: 'easingY1',
    easingX2: 'easingX2',
    easingY2: 'easingY2',
    animationDelayFactor: 'animationDelayFactor',
    backgroundTransitionDurationClockwise: 'backgroundTransitionDurationClockwise',
    backgroundTransitionDurationCounterclockwise: 'backgroundTransitionDurationCounterclockwise',
    targetAngle: 'targetAngle',
    influenceRange: 'influenceRange',
    maxPushAngle: 'maxPushAngle',
    expandingRotationDuration: 'expandingRotationDuration',
    debounceDelay: 'debounceDelay',
    opacityExpanded: 'opacityExpanded',
    opacityNearMin: 'opacityNearMin',
    opacityNearFactor: 'opacityNearFactor',
    opacityFar: 'opacityFar',
    opacityDefault: 'opacityDefault',
    scaleFactor: 'scaleFactor',
    graphSize: 'graphSize',
    graphMargin: 'graphMargin',
    centerNodeSizeDefault: 'centerNodeSizeDefault',
    centerNodeSizeExpanded: 'centerNodeSizeExpanded',
    centerNodeSizeShrunk: 'centerNodeSizeShrunk',
    centerNodeScaleSpeed: 'centerNodeScaleSpeed',
    normalizedReferenceHeightRatio: 'normalizedReferenceHeightRatio',
    circularNodeRadiusFactor: 'circularNodeRadiusFactor',
    circularNodeOffsetX: 'circularNodeOffsetX',
    circularNodeOffsetY: 'circularNodeOffsetY',
    circularNodeFontSize: 'circularNodeFontSize',
    circularNodeContentFontSize: 'circularNodeContentFontSize',
    circularNodeRadius: 'circularNodeRadius',
  }

  // 参数格式化函数
  const formatParamValue = (key: string, value: number | string | boolean): string => {
    if (typeof value === 'number') {
      if (
        key.includes('Duration') ||
        key === 'expandingRotationDuration' ||
        key === 'debounceDelay'
      ) {
        return `${value}s`
      } else if (key === 'transformDuration' || key === 'opacityDuration') {
        return `${value.toFixed(1)}s`
      } else if (key.startsWith('easing')) {
        return value.toFixed(2)
      } else if (
        key.includes('Size') ||
        key.includes('graphSize') ||
        key.includes('graphMargin') ||
        key === 'radiusX' ||
        key === 'radiusY' ||
        key === 'dragThreshold' ||
        key === 'minBackgroundRadius' ||
        key === 'circularNodeOffsetX' ||
        key === 'circularNodeOffsetY' ||
        key === 'circularNodeRadius'
      ) {
        return `${value}px`
      } else if (key === 'targetAngle') {
        return `${value}°`
      } else if (key === 'influenceRange' || key === 'maxPushAngle') {
        return `${((value * 180) / Math.PI).toFixed(1)}°`
      } else if (key === 'circularNodeFontSize' || key === 'circularNodeContentFontSize') {
        return `${value.toFixed(2)}rem`
      }
      return String(value)
    }
    return String(value)
  }

  // 比较每个参数
  Object.keys(local).forEach((key) => {
    const localVal = local[key as keyof typeof local]
    const defVal = def[key as keyof typeof def]

    // 对于数字类型，使用精度比较
    if (typeof localVal === 'number' && typeof defVal === 'number') {
      // 浮点数比较使用小的误差范围
      const epsilon = Math.abs(localVal) < 1 ? 0.001 : 0.01
      if (Math.abs(localVal - defVal) > epsilon) {
        modified.push({
          key,
          label: paramLabels[key] || key,
          value: localVal,
          formatted: formatParamValue(key, localVal),
        })
      }
    } else if (localVal !== defVal) {
      modified.push({
        key,
        label: paramLabels[key] || key,
        value: localVal,
        formatted: formatParamValue(key, localVal),
      })
    }
  })

  return modified
})

// 节点管理相关数据
const centerNode = computed<ChapterNode | null>(() => {
  return props.currentChapter || null
})

const circularNodes = computed<ChapterNode[]>(() => {
  if (!props.currentChapter || !props.currentChapter.children) {
    return []
  }
  // 根据当前中心节点的层级来决定显示哪些子节点
  const currentLevel = props.currentChapter.level ?? 0
  if (currentLevel === 0) {
    // 主章节，显示level=1的子节点
    return props.currentChapter.children.filter((child) => child.level === 1) || []
  } else if (currentLevel === 1) {
    // 子章节，显示level=2的子节点
    return props.currentChapter.children.filter((child) => child.level === 2) || []
  }
  return props.currentChapter.children || []
})

// 树形数据结构
interface TreeNode extends ChapterNode {
  nodeType?: 'center' | 'circular'
  label: string
}

// 递归转换节点为树形结构
const convertNodeToTreeNode = (
  node: ChapterNode,
  nodeType: 'center' | 'circular' = 'circular',
  includeChildren: boolean = true,
): TreeNode => {
  const treeNode: TreeNode = {
    ...node,
    nodeType,
    label: node.label || node.name,
    children:
      includeChildren && node.children && node.children.length > 0
        ? node.children.map((child) => convertNodeToTreeNode(child, 'circular'))
        : undefined,
  }
  return treeNode
}

// 树形数据
const treeData = computed<TreeNode[]>(() => {
  if (!centerNode.value) {
    return []
  }

  // 转换根节点时不递归处理 children，避免与 circularNodes 重复
  const rootNode = convertNodeToTreeNode(centerNode.value, 'center', false)

  // 如果有子节点，将它们添加到根节点的 children 中
  if (circularNodes.value.length > 0) {
    rootNode.children = circularNodes.value.map((node) => convertNodeToTreeNode(node, 'circular'))
  }

  return [rootNode]
})

// 树形组件状态
const expandedNodes = ref<string[]>([])
const selectedNode = ref<string | null>(null)

// 监听中心节点变化，自动展开
watch(
  () => centerNode.value?.id,
  (newId) => {
    if (newId) {
      expandedNodes.value = [newId]
      selectedNode.value = newId
    }
  },
  { immediate: true },
)

// 对话框状态
const showAddCircularNodeDialog = ref(false)
const showEditCircularNodeDialog = ref(false)
const showEditCenterNodeDialog = ref(false)
const showDeleteCenterNodeDialog = ref(false)

// 新建节点数据
const newNodeName = ref('')
const newNodeId = ref('')
const newNodeLevel = ref<number | null>(1)
const newNodeParentId = ref<string | null>(null) // 父节点ID

// 编辑节点数据
const editingNode = ref<ChapterNode>({
  id: '',
  name: '',
  level: null,
  label: '',
  isRoot: false,
  updateTime: '',
  children: [],
})

const editingCenterNode = ref<ChapterNode>({
  id: '',
  name: '',
  level: null,
  label: '',
  isRoot: false,
  updateTime: '',
  children: [],
})

// 监听外部参数变化
watch(
  () => props.params,
  (newParams) => {
    if (newParams && Object.keys(newParams).length > 0) {
      localParams.value = { ...localParams.value, ...newParams }
    }
  },
  { deep: true },
)

// 更新参数并通知父组件
const updateParams = () => {
  emit('update:params', { ...localParams.value })
}

// 生成唯一ID
const generateNodeId = (): string => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 添加圆周节点
const handleAddCircularNode = () => {
  if (!newNodeName.value.trim()) {
    return
  }

  const parentId = newNodeParentId.value || props.currentChapter?.id || null
  const parentLevel = props.currentChapter?.level ?? 0
  const newNodeLevelValue = newNodeLevel.value ?? parentLevel + 1

  const newNode: ChapterNode = {
    id: newNodeId.value.trim() || generateNodeId(),
    name: newNodeName.value.trim(),
    level: newNodeLevelValue,
    label: newNodeName.value.trim(),
    children: [],
    isRoot: false,
    updateTime: new Date().toISOString(),
    parentId: parentId,
  }

  emit('update:nodes', 'add', 'circular', newNode)

  // 重置表单
  newNodeName.value = ''
  newNodeId.value = ''
  newNodeLevel.value = null
  newNodeParentId.value = null
  showAddCircularNodeDialog.value = false

  // 如果添加成功，展开父节点
  if (parentId) {
    if (!expandedNodes.value.includes(parentId)) {
      expandedNodes.value.push(parentId)
    }
  }
}

// 从树节点添加子节点
const handleAddChildNode = (parentNode: TreeNode) => {
  newNodeParentId.value = parentNode.id
  newNodeLevel.value = (parentNode.level ?? 0) + 1
  showAddCircularNodeDialog.value = true
}

// 编辑圆周节点
const editCircularNode = (node: ChapterNode) => {
  editingNode.value = {
    id: node.id,
    name: node.name,
    level: node.level ?? 1,
    label: node.label || node.name,
    children: node.children || [],
    isRoot: false,
    updateTime: new Date().toISOString(),
    parentId: node.parentId || props.currentChapter?.id || null,
  }
  showEditCircularNodeDialog.value = true
}

// 从树节点编辑节点
const handleEditNodeFromTree = (node: TreeNode) => {
  if (node.nodeType === 'center') {
    handleEditCenterNode()
  } else {
    editCircularNode(node)
  }
}

// 从树节点删除节点
const handleDeleteNodeFromTree = (node: TreeNode) => {
  if (node.nodeType === 'center') {
    showDeleteCenterNodeDialog.value = true
  } else {
    deleteCircularNode(node.id)
  }
}

// 根据ID获取节点名称（用于显示父节点信息）
const getNodeNameById = (nodeId: string | null): string => {
  if (!nodeId) return ''

  // 检查是否是中心节点
  if (centerNode.value?.id === nodeId) {
    return centerNode.value.name
  }

  // 检查圆周节点
  const node = circularNodes.value.find((n) => n.id === nodeId)
  if (node) {
    return node.name
  }

  // 递归检查子节点
  const findInChildren = (children: ChapterNode[] | undefined): string => {
    if (!children) return ''
    for (const child of children) {
      if (child.id === nodeId) {
        return child.name
      }
      const found = findInChildren(child.children)
      if (found) return found
    }
    return ''
  }

  return findInChildren(centerNode.value?.children) || nodeId
}

// 更新圆周节点
const handleUpdateCircularNode = () => {
  if (!editingNode.value.name.trim()) {
    return
  }

  const updatedNode: ChapterNode = {
    ...editingNode.value,
    name: editingNode.value.name.trim(),
    label: editingNode.value.label || editingNode.value.name.trim(),
    isRoot: false,
    updateTime: new Date().toISOString(),
  }

  // 查找原始节点
  const originalNode = circularNodes.value.find((n) => n.id === editingNode.value.id)

  emit('update:nodes', 'update', 'circular', updatedNode, originalNode)

  showEditCircularNodeDialog.value = false
  editingNode.value = { id: '', name: '', level: null, isRoot: false, updateTime: '', label: '' }
}

// 删除圆周节点
const deleteCircularNode = (nodeId: string) => {
  const node = circularNodes.value.find((n) => n.id === nodeId)
  if (node) {
    emit('update:nodes', 'delete', 'circular', node)
  }
}

// 编辑中心节点
const handleEditCenterNode = () => {
  if (!centerNode.value) return

  editingCenterNode.value = {
    id: centerNode.value.id,
    name: centerNode.value.name,
    level: centerNode.value.level ?? 0,
    label: centerNode.value.label || centerNode.value.name,
    children: centerNode.value.children || [],
    isRoot: centerNode.value.isRoot || false,
    updateTime: centerNode.value.updateTime || new Date().toISOString(),
    parentId: centerNode.value.parentId || null,
  }
  showEditCenterNodeDialog.value = true
}

// 更新中心节点
const handleUpdateCenterNode = () => {
  if (!editingCenterNode.value.name.trim()) {
    return
  }

  const updatedNode: ChapterNode = {
    ...editingCenterNode.value,
    name: editingCenterNode.value.name.trim(),
    label: editingCenterNode.value.label || editingCenterNode.value.name.trim(),
    updateTime: new Date().toISOString(),
  }

  emit('update:nodes', 'update', 'center', updatedNode, centerNode.value || undefined)

  showEditCenterNodeDialog.value = false
  editingCenterNode.value = {
    id: '',
    name: '',
    level: null,
    isRoot: false,
    updateTime: '',
    label: '',
  }
}

// 删除中心节点
const handleDeleteCenterNode = () => {
  if (centerNode.value) {
    emit('update:nodes', 'delete', 'center', centerNode.value)
  }
  showDeleteCenterNodeDialog.value = false
}

// 重置函数
const resetRadiusX = () => {
  localParams.value.radiusX = defaultParams.value.radiusX
  updateParams()
}

const resetRadiusY = () => {
  localParams.value.radiusY = defaultParams.value.radiusY
  updateParams()
}

const resetDragThreshold = () => {
  localParams.value.dragThreshold = defaultParams.value.dragThreshold
  updateParams()
}

const resetMinBackgroundRadius = () => {
  localParams.value.minBackgroundRadius = defaultParams.value.minBackgroundRadius
  updateParams()
}

const resetRadiusScaleNone = () => {
  localParams.value.radiusScaleNone = defaultParams.value.radiusScaleNone
  updateParams()
}

const resetRadiusScaleSmall = () => {
  localParams.value.radiusScaleSmall = defaultParams.value.radiusScaleSmall
  updateParams()
}

const resetRadiusScaleMedium = () => {
  localParams.value.radiusScaleMedium = defaultParams.value.radiusScaleMedium
  updateParams()
}

const resetRadiusScaleLarge = () => {
  localParams.value.radiusScaleLarge = defaultParams.value.radiusScaleLarge
  updateParams()
}

// 动画参数重置函数
const resetTransformDuration = () => {
  localParams.value.transformDuration = defaultParams.value.transformDuration
  updateParams()
}

const resetOpacityDuration = () => {
  localParams.value.opacityDuration = defaultParams.value.opacityDuration
  updateParams()
}

const resetEasing = () => {
  localParams.value.easingX1 = defaultParams.value.easingX1
  localParams.value.easingY1 = defaultParams.value.easingY1
  localParams.value.easingX2 = defaultParams.value.easingX2
  localParams.value.easingY2 = defaultParams.value.easingY2
  updateParams()
}

const resetAnimationDelayFactor = () => {
  localParams.value.animationDelayFactor = defaultParams.value.animationDelayFactor
  updateParams()
}

const resetBackgroundTransitionDurationClockwise = () => {
  localParams.value.backgroundTransitionDurationClockwise =
    defaultParams.value.backgroundTransitionDurationClockwise
  updateParams()
}

const resetBackgroundTransitionDurationCounterclockwise = () => {
  localParams.value.backgroundTransitionDurationCounterclockwise =
    defaultParams.value.backgroundTransitionDurationCounterclockwise
  updateParams()
}

const resetTargetAngle = () => {
  localParams.value.targetAngle = defaultParams.value.targetAngle
  updateParams()
}

const resetInfluenceRange = () => {
  localParams.value.influenceRange = defaultParams.value.influenceRange
  updateParams()
}

const resetMaxPushAngle = () => {
  localParams.value.maxPushAngle = defaultParams.value.maxPushAngle
  updateParams()
}

const resetExpandingRotationDuration = () => {
  localParams.value.expandingRotationDuration = defaultParams.value.expandingRotationDuration
  updateParams()
}

const resetDebounceDelay = () => {
  localParams.value.debounceDelay = defaultParams.value.debounceDelay
  updateParams()
}

const resetOpacityExpanded = () => {
  localParams.value.opacityExpanded = defaultParams.value.opacityExpanded
  updateParams()
}

const resetOpacityNearMin = () => {
  localParams.value.opacityNearMin = defaultParams.value.opacityNearMin
  updateParams()
}

const resetOpacityNearFactor = () => {
  localParams.value.opacityNearFactor = defaultParams.value.opacityNearFactor
  updateParams()
}

const resetOpacityFar = () => {
  localParams.value.opacityFar = defaultParams.value.opacityFar
  updateParams()
}

const resetOpacityDefault = () => {
  localParams.value.opacityDefault = defaultParams.value.opacityDefault
  updateParams()
}

const resetScaleFactor = () => {
  localParams.value.scaleFactor = defaultParams.value.scaleFactor
  updateParams()
}

const resetGraphSize = () => {
  localParams.value.graphSize = defaultParams.value.graphSize
  updateParams()
}

const resetGraphMargin = () => {
  localParams.value.graphMargin = defaultParams.value.graphMargin
  updateParams()
}

const resetCenterNodeSizeDefault = () => {
  localParams.value.centerNodeSizeDefault = defaultParams.value.centerNodeSizeDefault
  updateParams()
}

const resetCenterNodeSizeExpanded = () => {
  localParams.value.centerNodeSizeExpanded = defaultParams.value.centerNodeSizeExpanded
  updateParams()
}

const resetCenterNodeSizeShrunk = () => {
  localParams.value.centerNodeSizeShrunk = defaultParams.value.centerNodeSizeShrunk
  updateParams()
}

const resetCenterNodeScaleSpeed = () => {
  localParams.value.centerNodeScaleSpeed = defaultParams.value.centerNodeScaleSpeed
  updateParams()
}

const resetNodeEnterExitDuration = () => {
  localParams.value.nodeEnterExitDuration = defaultParams.value.nodeEnterExitDuration
  updateParams()
}

const resetNodeExpandDelayInterval = () => {
  localParams.value.nodeExpandDelayInterval = defaultParams.value.nodeExpandDelayInterval
  updateParams()
}

const resetNodeCollapseDelayInterval = () => {
  localParams.value.nodeCollapseDelayInterval = defaultParams.value.nodeCollapseDelayInterval
  updateParams()
}

const resetNodeContentTransitionDuration = () => {
  localParams.value.nodeContentTransitionDuration =
    defaultParams.value.nodeContentTransitionDuration
  updateParams()
}

const resetNodeBaseTransitionDuration = () => {
  localParams.value.nodeBaseTransitionDuration = defaultParams.value.nodeBaseTransitionDuration
  updateParams()
}

const resetLearningTagTransitionDuration = () => {
  localParams.value.learningTagTransitionDuration =
    defaultParams.value.learningTagTransitionDuration
  updateParams()
}

const resetLearningTagPosition = () => {
  localParams.value.learningTagTop = defaultParams.value.learningTagTop
  localParams.value.learningTagLeft = defaultParams.value.learningTagLeft
  localParams.value.learningTagTranslateX = defaultParams.value.learningTagTranslateX
  updateParams()
}

const resetBubbleButtonTransitionDuration = () => {
  localParams.value.bubbleButtonTransitionDuration =
    defaultParams.value.bubbleButtonTransitionDuration
  updateParams()
}

const resetNodeActiveTransitionDuration = () => {
  localParams.value.nodeActiveTransitionDuration = defaultParams.value.nodeActiveTransitionDuration
  updateParams()
}

const resetCircularNodeRadiusFactor = () => {
  localParams.value.circularNodeRadiusFactor = defaultParams.value.circularNodeRadiusFactor
  updateParams()
}

const resetCircularNodeOffsetX = () => {
  localParams.value.circularNodeOffsetX = defaultParams.value.circularNodeOffsetX
  updateParams()
}

const resetCircularNodeOffsetY = () => {
  localParams.value.circularNodeOffsetY = defaultParams.value.circularNodeOffsetY
  updateParams()
}

const resetCircularNodeFontSize = () => {
  localParams.value.circularNodeFontSize = defaultParams.value.circularNodeFontSize
  updateParams()
}

const resetCircularNodeContentFontSize = () => {
  localParams.value.circularNodeContentFontSize = defaultParams.value.circularNodeContentFontSize
  updateParams()
}

const resetCircularNodeRadius = () => {
  localParams.value.circularNodeRadius = defaultParams.value.circularNodeRadius
  updateParams()
}

const resetNormalizedReferenceHeightRatio = () => {
  localParams.value.normalizedReferenceHeightRatio =
    defaultParams.value.normalizedReferenceHeightRatio
  updateParams()
}

const resetAllParams = () => {
  localParams.value = { ...defaultParams.value }
  updateParams()
}

// 获取带用户ID前缀的存储key
const getDebugParamsKey = () => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_knowledgeGraphDebugParams`
}

// 保存到本地存储
const saveToLocalStorage = () => {
  try {
    const key = getDebugParamsKey()
    localStorage.setItem(key, JSON.stringify(localParams.value))
  } catch (error) {
    console.error('❌ 保存参数失败:', error)
  }
}

// 从本地存储加载（内部函数，支持静默模式）
const loadFromLocalStorageInternal = (silent = false) => {
  try {
    const key = getDebugParamsKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      // 合并顺序：默认值 -> localStorage保存的值 -> props传入的值（props优先级最高）
      localParams.value = { ...defaultParams.value, ...parsed, ...props.params }
      updateParams()
      if (!silent) {
      }
    } else {
      if (!silent) {
      }
    }
  } catch (error) {
    console.error('❌ 加载参数失败:', error)
  }
}

// 从本地存储加载（用于按钮点击）
const loadFromLocalStorage = () => {
  loadFromLocalStorageInternal(false)
}

// 自动保存防抖定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// 自动保存到本地存储（带防抖，500ms）
const autoSaveToLocalStorage = () => {
  // 清除之前的定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  // 设置新的定时器
  autoSaveTimer = setTimeout(() => {
    try {
      const key = getDebugParamsKey()
      localStorage.setItem(key, JSON.stringify(localParams.value))
      // 不输出日志，避免控制台过于频繁
    } catch (error) {
      console.error('❌ 自动保存参数失败:', error)
    }
  }, 500) // 500ms 防抖延迟
}

// 监听 localParams 变化，自动保存
watch(
  localParams,
  () => {
    autoSaveToLocalStorage()
  },
  { deep: true } // 深度监听，确保所有嵌套属性的变化都能被捕获
)

// 组件挂载时自动从本地存储加载参数（静默模式，避免不必要的日志）
onMounted(() => {
  loadFromLocalStorageInternal(true)
})
</script>

<style lang="scss" scoped>
.debug-panel-wrapper {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 3000;
  display: flex;
  align-items: center;

  // 隐藏状态下不拦截点击事件，让点击可以穿透到后面的元素
  &:not(.expanded) {
    pointer-events: none;
  }

  .debug-panel-card {
    width: 400px;
    max-width: calc(100vw - 60px);
    height: 100%;
    border-radius: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
    transition: transform 0.3s ease-in-out;
    transform: translateX(-100%);

    // 展开状态
    .expanded & {
      transform: translateX(0);
      pointer-events: auto;
    }
  }

  // 展开状态时面板完全显示
  &.expanded {
    pointer-events: auto;

    .debug-panel-card {
      transform: translateX(0);
    }
  }

  // 收缩/展开按钮
  .toggle-button {
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%) translateX(-50%);
    z-index: 3001;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-left: none;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
    transition: all 0.3s ease-in-out;
    width: 32px;
    height: 32px;

    &:hover {
      background: rgba(255, 255, 255, 1);
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    }

    // 展开状态下的按钮位置（跟随面板右侧边框）
    &.expanded {
      left: 380px;
      transform: translateY(-50%) translateX(0);
      border-left: 1px solid rgba(0, 0, 0, 0.12);
      border-right: none;
      box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);

      &:hover {
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
      }
    }
  }
}

:deep(.q-expansion-item__header) {
  font-weight: 500;
}

:deep(.q-slider__track) {
  height: 8px;
}

:deep(.q-slider__thumb) {
  width: 20px;
  height: 20px;
}

.parameter-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 0, 0, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .q-card-section {
    padding: 16px;
  }
}

// Header样式 - 固定在顶部
.debug-panel-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding: 8px 12px !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

// Header顶部标题区域
.header-top {
  display: flex;
  align-items: center;
  margin-bottom: 6px;

  .header-title {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.2;
  }
}

// 参数显示区域 - 缩小尺寸
.params-display {
  margin-bottom: 6px;

  .params-content {
    padding: 0;

    .params-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px 8px;
      font-size: 0.7rem;

      .param-item {
        display: flex;
        align-items: center;
        line-height: 1.3;

        .param-label {
          color: rgba(0, 0, 0, 0.7);
          margin-right: 4px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 0;
        }

        .param-value {
          color: #1976d2;
          font-weight: 600;
          white-space: nowrap;
          flex: 1;
          text-align: right;
        }
      }
    }
  }
}

// Header功能按钮区域
.header-actions {
  margin-top: 6px;

  .q-btn {
    font-size: 0.7rem;
    padding: 4px 8px;
    min-height: 24px;

    :deep(.q-btn__content) {
      .q-icon {
        font-size: 0.875rem;
      }
    }
  }
}
</style>
