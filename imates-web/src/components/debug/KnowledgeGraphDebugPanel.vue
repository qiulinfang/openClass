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
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 知识图谱调试面板</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="isVisible = false" />
      </q-card-section>

      <!-- 参数控制区域 -->
      <q-card-section>
        <!-- ========== 一、轨迹与位置参数 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm" style="color: #1976d2;">
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
                    <span class="text-body2 text-primary q-ml-md">当前: {{ localParams.radiusX }}px</span>
                  </div>
                  
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制椭圆轨迹的水平半径，影响节点在水平方向的运动范围<br/>
                    <strong>放大效果：</strong>节点在水平方向上分散得更开，椭圆更宽，左右间距增大<br/>
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusX"
                />
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
                    <span class="text-body2 text-primary q-ml-md">当前: {{ localParams.radiusY }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制椭圆轨迹的垂直半径，影响节点在垂直方向的运动范围<br/>
                    <strong>放大效果：</strong>节点在垂直方向上分散得更开，椭圆更高，上下间距增大<br/>
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusY"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.radiusY }}px</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 角度参数 -->
        <q-expansion-item
          icon="navigation"
          label="角度参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 目标角度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="navigation" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">目标角度 (度)</div>
                    <span class="text-body2 text-primary q-ml-md">当前: {{ localParams.targetAngle.toFixed(1) }}°</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    自动定位时的目标角度，用于定位知识图谱<br/>
                    <strong>增大效果：</strong>节点自动定位时更偏向右侧（顺时针方向），展开位置向右移动<br/>
                    <strong>减小效果：</strong>节点自动定位时更偏向左侧（逆时针方向），展开位置向左移动
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.targetAngle"
                :min="0"
                :max="360"
                :step="1"
                label
                :label-value="`${localParams.targetAngle.toFixed(0)}°`"
                color="primary"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetTargetAngle"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.targetAngle.toFixed(1) }}°</span>
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
                    <div class="text-subtitle2">影响范围 (度)</div>
                    <span class="text-body2 text-primary q-ml-md">当前: {{ (localParams.influenceRange * 180 / Math.PI).toFixed(1) }}°</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    展开图谱周围的影响范围，影响附近节点的行为<br/>
                    <strong>放大效果：</strong>更大范围的节点会受到影响（变透明、被推开），影响区域扩大<br/>
                    <strong>缩小效果：</strong>只有紧邻的节点会受到影响，影响区域缩小
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.influenceRange"
                :min="Math.PI / 6"
                :max="Math.PI"
                :step="Math.PI / 180"
                label
                :label-value="`${(localParams.influenceRange * 180 / Math.PI).toFixed(1)}°`"
                color="primary"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetInfluenceRange"
                />
                <span class="text-caption text-grey-6">默认: {{ (defaultParams.influenceRange * 180 / Math.PI).toFixed(1) }}°</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 最大推开角度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="open_in_full" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">最大推开角度 (度)</div>
                    <span class="text-body2 text-primary q-ml-md">当前: {{ (localParams.maxPushAngle * 180 / Math.PI).toFixed(1) }}°</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    其他节点被推开的最大角度<br/>
                    <strong>放大效果：</strong>节点被推开的距离更大，展开时周围节点距离更远，空间更开阔<br/>
                    <strong>缩小效果：</strong>节点被推开的距离更小，展开时周围节点距离更近，空间更紧凑
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.maxPushAngle"
                :min="Math.PI / 36"
                :max="Math.PI / 2"
                :step="Math.PI / 180"
                label
                :label-value="`${(localParams.maxPushAngle * 180 / Math.PI).toFixed(1)}°`"
                color="primary"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetMaxPushAngle"
                />
                <span class="text-caption text-grey-6">默认: {{ (defaultParams.maxPushAngle * 180 / Math.PI).toFixed(1) }}°</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 三、视觉效果参数 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #388e3c;">
          🎨 视觉效果
        </div>

        <!-- 背景圆形参数 -->
        <q-expansion-item
          icon="brightness_1"
          label="背景圆形参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 最小背景半径 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="crop_square" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">最小背景半径 (像素)</div>
                    <span class="text-body2 text-teal q-ml-md">当前: {{ localParams.minBackgroundRadius }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    节点背景圆形的最小显示半径，确保节点始终可见且易于交互<br/>
                    <strong>放大效果：</strong>背景圆形更大，点击区域更大，更容易点击，视觉更突出<br/>
                    <strong>缩小效果：</strong>背景圆形更小，点击区域更小，更节省空间，但可能不易点击
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetMinBackgroundRadius"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.minBackgroundRadius }}px</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 背景半径缩放因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_out_map" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">节点数 ≤ 2 时的半径缩放</div>
                    <span class="text-body2 text-teal q-ml-md">当前: {{ (localParams.radiusScaleSmall * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    当知识图谱中节点数量较少（≤2个）时，背景半径的缩放比例<br/>
                    <strong>放大效果：</strong>节点少时背景圆形更大，视觉更突出，占用更多空间<br/>
                    <strong>缩小效果：</strong>节点少时背景圆形更小，视觉更紧凑，节省空间
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleSmall"
                :min="0.5"
                :max="1.2"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleSmall * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleSmall"
                />
                <span class="text-caption text-grey-6">默认: {{ (defaultParams.radiusScaleSmall * 100).toFixed(0) }}%</span>
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
                    <span class="text-body2 text-teal q-ml-md">当前: {{ (localParams.radiusScaleMedium * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    当知识图谱中节点数量中等（3-4个）时，背景半径的缩放比例<br/>
                    <strong>放大效果：</strong>中等节点数时背景圆形更大，视觉更突出<br/>
                    <strong>缩小效果：</strong>中等节点数时背景圆形更小，视觉更紧凑
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleMedium"
                :min="0.8"
                :max="1.5"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleMedium * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleMedium"
                />
                <span class="text-caption text-grey-6">默认: {{ (defaultParams.radiusScaleMedium * 100).toFixed(0) }}%</span>
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
                    <span class="text-body2 text-teal q-ml-md">当前: {{ (localParams.radiusScaleLarge * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    当知识图谱中节点数量较多（>4个）时，背景半径的缩放比例<br/>
                    <strong>放大效果：</strong>节点多时背景圆形更大，视觉更突出但可能拥挤<br/>
                    <strong>缩小效果：</strong>节点多时背景圆形更小，避免拥挤，视觉更紧凑
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleLarge"
                :min="0.9"
                :max="1.6"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleLarge * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleLarge"
                />
                <span class="text-caption text-grey-6">默认: {{ (defaultParams.radiusScaleLarge * 100).toFixed(0) }}%</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 透明度参数 -->
        <q-expansion-item
          icon="opacity"
          label="透明度参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 展开的知识图谱透明度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="visibility" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">展开图谱透明度</div>
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityExpanded.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    展开的知识图谱的透明度值（0-1）<br/>
                    <strong>放大效果：</strong>展开的图谱更不透明（更清晰），背景更不明显，前景更突出<br/>
                    <strong>缩小效果：</strong>展开的图谱更透明（更模糊），背景更明显，前景更融入背景
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityExpanded"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityExpanded.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 距离相关透明度最小值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="opacity" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">距离相关透明度最小值</div>
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityNearMin.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    距离展开图谱较近的节点的最小透明度<br/>
                    <strong>放大效果：</strong>附近节点更不透明（更清晰），更容易看到细节<br/>
                    <strong>缩小效果：</strong>附近节点更透明（更模糊），更融入背景，突出展开的节点
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityNearMin"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityNearMin.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityNearFactor.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制距离对透明度的影响程度<br/>
                    <strong>放大效果：</strong>距离对透明度影响更大，距离变化时透明度变化更明显，层次感更强<br/>
                    <strong>缩小效果：</strong>距离对透明度影响更小，距离变化时透明度变化不明显，层次感更弱
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityNearFactor"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityNearFactor.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityFar.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    距离展开图谱较远的节点的透明度<br/>
                    <strong>放大效果：</strong>远处节点更不透明（更清晰），所有节点都更容易看到<br/>
                    <strong>缩小效果：</strong>远处节点更透明（更模糊），更融入背景，焦点更集中在展开的节点
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityFar"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityFar.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityDefault.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    默认状态下知识图谱的透明度<br/>
                    <strong>放大效果：</strong>未展开的图谱更不透明（更清晰），更容易看到内容<br/>
                    <strong>缩小效果：</strong>未展开的图谱更透明（更模糊），更融入背景，突出展开的图谱
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityDefault"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityDefault.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 缩放和尺寸参数 -->
        <q-expansion-item
          icon="aspect_ratio"
          label="缩放和尺寸参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 缩放因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_in" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">缩放因子</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.scaleFactor.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制距离相关的缩放幅度<br/>
                    <strong>放大效果：</strong>距离对节点大小影响更大，展开时附近节点明显变大，远处节点明显变小，大小对比更强烈<br/>
                    <strong>缩小效果：</strong>距离对节点大小影响更小，展开时节点大小变化不明显，大小更一致
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
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetScaleFactor"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.scaleFactor.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 图形尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="crop_free" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">图形尺寸 (像素)</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.graphSize }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    知识图谱的宽度和高度（像素）<br/>
                    <strong>放大效果：</strong>图谱显示更大，内容更清晰，但占用更多屏幕空间，可能与其他元素重叠<br/>
                    <strong>缩小效果：</strong>图谱显示更小，节省屏幕空间，但内容可能看不清，需要放大查看
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
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetGraphSize"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.graphSize }}px</span>
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
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.graphMargin }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">图形位置偏移量，用于居中定位（负值）</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.graphMargin"
                :min="100"
                :max="500"
                :step="10"
                label
                :label-value="`${localParams.graphMargin}px`"
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetGraphMargin"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.graphMargin }}px</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 旋转计算系数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="settings_overscan" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">旋转计算系数</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.rotationCoefficient.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制旋转角度与滑动距离的比例关系<br/>
                    <strong>放大效果：</strong>同样的滑动距离产生更大的旋转角度，节点旋转更快，需要更少滑动就能旋转到位<br/>
                    <strong>缩小效果：</strong>同样的滑动距离产生更小的旋转角度，节点旋转更慢，需要更多滑动才能旋转到位
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.rotationCoefficient"
                :min="0.1"
                :max="2"
                :step="0.01"
                label
                :label-value="localParams.rotationCoefficient.toFixed(2)"
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRotationCoefficient"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.rotationCoefficient.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- ========== 四、动画效果参数 ========== -->
        <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #c2185b;">
          ✨ 动画效果
        </div>

        <!-- 动画参数 -->
        <q-expansion-item
          icon="animation"
          label="动画参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 位置变换动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="timeline" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">位置变换动画持续时间 (秒)</div>
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.transformDuration.toFixed(1) }}s</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制节点位置变换动画的持续时间<br/>
                    <strong>放大效果：</strong>位置变化动画更慢，过渡更平滑但可能感觉拖沓，适合慢节奏体验<br/>
                    <strong>缩小效果：</strong>位置变化动画更快，过渡更干脆但可能感觉生硬，适合快节奏体验
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetTransformDuration"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.transformDuration.toFixed(1) }}s</span>
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
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.opacityDuration.toFixed(1) }}s</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制节点透明度变化的动画持续时间<br/>
                    <strong>放大效果：</strong>透明度变化动画更慢，淡入淡出效果更柔和，过渡更平滑<br/>
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityDuration"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityDuration.toFixed(1) }}s</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 缓动函数参数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="tune" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">缓动函数参数 (cubic-bezier)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制动画的缓动效果，格式: cubic-bezier(x1, y1, x2, y2)<br/>
                    <strong>X1/Y1/X2/Y2 增大：</strong>缓动曲线更陡峭，动画开始/结束更快，中间可能更慢或更快<br/>
                    <strong>X1/Y1/X2/Y2 减小：</strong>缓动曲线更平缓，动画开始/结束更慢，中间更匀速<br/>
                    <strong>典型效果：</strong>X2=0.45, Y2=0.94 是缓进缓出，0.25,0.1,0.25,1 是缓入，0.42,0,0.58,1 是缓出
                  </div>
                </div>
              </div>
              
              <!-- X1 参数 -->
              <div class="q-mb-sm">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="text-caption">X1</div>
                  <span class="text-caption text-pink">当前: {{ localParams.easingX1.toFixed(2) }}</span>
                </div>
                <q-slider
                  v-model="localParams.easingX1"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.easingX1.toFixed(2)"
                  color="pink"
                  @update:model-value="updateParams"
                />
              </div>
              
              <!-- Y1 参数 -->
              <div class="q-mb-sm">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="text-caption">Y1</div>
                  <span class="text-caption text-pink">当前: {{ localParams.easingY1.toFixed(2) }}</span>
                </div>
                <q-slider
                  v-model="localParams.easingY1"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.easingY1.toFixed(2)"
                  color="pink"
                  @update:model-value="updateParams"
                />
              </div>
              
              <!-- X2 参数 -->
              <div class="q-mb-sm">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="text-caption">X2</div>
                  <span class="text-caption text-pink">当前: {{ localParams.easingX2.toFixed(2) }}</span>
                </div>
                <q-slider
                  v-model="localParams.easingX2"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.easingX2.toFixed(2)"
                  color="pink"
                  @update:model-value="updateParams"
                />
              </div>
              
              <!-- Y2 参数 -->
              <div class="q-mb-sm">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="text-caption">Y2</div>
                  <span class="text-caption text-pink">当前: {{ localParams.easingY2.toFixed(2) }}</span>
                </div>
                <q-slider
                  v-model="localParams.easingY2"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  label
                  :label-value="localParams.easingY2.toFixed(2)"
                  color="pink"
                  @update:model-value="updateParams"
                />
              </div>
              
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetEasing"
                />
                <span class="text-caption text-grey-6">
                  当前: cubic-bezier({{ localParams.easingX1.toFixed(2) }}, {{ localParams.easingY1.toFixed(2) }}, {{ localParams.easingX2.toFixed(2) }}, {{ localParams.easingY2.toFixed(2) }})
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
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.animationDelayFactor.toFixed(2) }}s</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制基于距离的动画延迟计算系数，值越大延迟越长<br/>
                    <strong>放大效果：</strong>距离越远的节点动画延迟越长，产生波浪式展开效果，视觉更动感但可能感觉慢<br/>
                    <strong>缩小效果：</strong>距离对延迟影响更小，所有节点几乎同时动画，展开更统一但动感较弱
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetAnimationDelayFactor"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.animationDelayFactor.toFixed(2) }}s</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 背景圆形过渡时间（顺时针） -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="rotate_right" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">背景圆形过渡时间 - 顺时针 (秒)</div>
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.backgroundTransitionDurationClockwise.toFixed(1) }}s</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    顺时针旋转时背景圆形的收缩速度<br/>
                    <strong>放大效果：</strong>顺时针旋转时背景圆形收缩更慢，过渡更平滑，视觉更柔和<br/>
                    <strong>缩小效果：</strong>顺时针旋转时背景圆形收缩更快，过渡更干脆，响应更迅速
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
                <span class="text-caption text-grey-6">默认: {{ defaultParams.backgroundTransitionDurationClockwise.toFixed(1) }}s</span>
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
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.backgroundTransitionDurationCounterclockwise.toFixed(1) }}s</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    逆时针旋转时背景圆形的收缩速度<br/>
                    <strong>放大效果：</strong>逆时针旋转时背景圆形收缩更慢，过渡更平滑，视觉更柔和<br/>
                    <strong>缩小效果：</strong>逆时针旋转时背景圆形收缩更快，过渡更干脆，响应更迅速
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
                <span class="text-caption text-grey-6">默认: {{ defaultParams.backgroundTransitionDurationCounterclockwise.toFixed(1) }}s</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 动画时长参数 -->
        <q-expansion-item
          icon="timer"
          label="动画时长参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 展开旋转动画持续时间 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="rotate_right" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">展开旋转动画持续时间 (毫秒)</div>
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.expandingRotationDuration }}ms</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    展开知识图谱时的旋转动画持续时间<br/>
                    <strong>放大效果：</strong>展开旋转动画更慢，旋转到目标位置需要更长时间，过渡更平滑但可能感觉慢<br/>
                    <strong>缩小效果：</strong>展开旋转动画更快，旋转到目标位置更快，响应更迅速但可能感觉生硬
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.expandingRotationDuration"
                :min="100"
                :max="2000"
                :step="50"
                label
                :label-value="`${localParams.expandingRotationDuration}ms`"
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
                <span class="text-caption text-grey-6">默认: {{ defaultParams.expandingRotationDuration }}ms</span>
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
                    <div class="text-subtitle2">防抖延迟 (毫秒)</div>
                    <span class="text-body2 text-pink q-ml-md">当前: {{ localParams.debounceDelay }}ms</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    避免与点击事件冲突的防抖延迟时间<br/>
                    <strong>放大效果：</strong>防抖延迟更长，拖拽后需要等待更长时间才能点击，避免误触但响应更慢<br/>
                    <strong>缩小效果：</strong>防抖延迟更短，拖拽后很快就能点击，响应更快但可能误触
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.debounceDelay"
                :min="0"
                :max="500"
                :step="10"
                label
                :label-value="`${localParams.debounceDelay}ms`"
                color="pink"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetDebounceDelay"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.debounceDelay }}ms</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 透明度参数 -->
        <q-expansion-item
          icon="opacity"
          label="透明度参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 展开的知识图谱透明度 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="visibility" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">展开图谱透明度</div>
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityExpanded.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    展开的知识图谱的透明度值（0-1）<br/>
                    <strong>放大效果：</strong>展开的图谱更不透明（更清晰），背景更不明显，前景更突出<br/>
                    <strong>缩小效果：</strong>展开的图谱更透明（更模糊），背景更明显，前景更融入背景
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityExpanded"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityExpanded.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 距离相关透明度最小值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="opacity" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">距离相关透明度最小值</div>
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityNearMin.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    距离展开图谱较近的节点的最小透明度<br/>
                    <strong>放大效果：</strong>附近节点更不透明（更清晰），更容易看到细节<br/>
                    <strong>缩小效果：</strong>附近节点更透明（更模糊），更融入背景，突出展开的节点
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityNearMin"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityNearMin.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityNearFactor.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制距离对透明度的影响程度<br/>
                    <strong>放大效果：</strong>距离对透明度影响更大，距离变化时透明度变化更明显，层次感更强<br/>
                    <strong>缩小效果：</strong>距离对透明度影响更小，距离变化时透明度变化不明显，层次感更弱
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityNearFactor"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityNearFactor.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityFar.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    距离展开图谱较远的节点的透明度<br/>
                    <strong>放大效果：</strong>远处节点更不透明（更清晰），所有节点都更容易看到<br/>
                    <strong>缩小效果：</strong>远处节点更透明（更模糊），更融入背景，焦点更集中在展开的节点
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityFar"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityFar.toFixed(2) }}</span>
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
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.opacityDefault.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    默认状态下知识图谱的透明度<br/>
                    <strong>放大效果：</strong>未展开的图谱更不透明（更清晰），更容易看到内容<br/>
                    <strong>缩小效果：</strong>未展开的图谱更透明（更模糊），更融入背景，突出展开的图谱
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
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetOpacityDefault"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.opacityDefault.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 缩放和尺寸参数 -->
        <q-expansion-item
          icon="aspect_ratio"
          label="缩放和尺寸参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 缩放因子 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_in" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">缩放因子</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.scaleFactor.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制距离相关的缩放幅度<br/>
                    <strong>放大效果：</strong>距离对节点大小影响更大，展开时附近节点明显变大，远处节点明显变小，大小对比更强烈<br/>
                    <strong>缩小效果：</strong>距离对节点大小影响更小，展开时节点大小变化不明显，大小更一致
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
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetScaleFactor"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.scaleFactor.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 图形尺寸 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="crop_free" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">图形尺寸 (像素)</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.graphSize }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    知识图谱的宽度和高度（像素）<br/>
                    <strong>放大效果：</strong>图谱显示更大，内容更清晰，但占用更多屏幕空间，可能与其他元素重叠<br/>
                    <strong>缩小效果：</strong>图谱显示更小，节省屏幕空间，但内容可能看不清，需要放大查看
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
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetGraphSize"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.graphSize }}px</span>
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
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.graphMargin }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    图形位置偏移量，用于居中定位（负值）<br/>
                    <strong>放大效果：</strong>图谱向左偏移更多，向右居中，可能影响左侧元素的显示<br/>
                    <strong>缩小效果：</strong>图谱向左偏移更少，更靠近原始位置，可能不够居中
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
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetGraphMargin"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.graphMargin }}px</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 旋转计算系数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="settings_overscan" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">旋转计算系数</div>
                    <span class="text-body2 text-indigo q-ml-md">当前: {{ localParams.rotationCoefficient.toFixed(2) }}</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制旋转角度与滑动距离的比例关系<br/>
                    <strong>放大效果：</strong>同样的滑动距离产生更大的旋转角度，节点旋转更快，需要更少滑动就能旋转到位<br/>
                    <strong>缩小效果：</strong>同样的滑动距离产生更小的旋转角度，节点旋转更慢，需要更多滑动才能旋转到位
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.rotationCoefficient"
                :min="0.1"
                :max="2"
                :step="0.01"
                label
                :label-value="localParams.rotationCoefficient.toFixed(2)"
                color="indigo"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRotationCoefficient"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.rotationCoefficient.toFixed(2) }}</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

                <!-- ========== 二、交互控制参数 ========== -->
                <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md" style="color: #f57c00;">
          🎮 交互控制
        </div>

        <!-- 滑动灵敏度参数 -->
        <q-expansion-item
          icon="touch_app"
          label="滑动灵敏度参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 基础灵敏度倍数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="tune" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">基础灵敏度倍数</div>
                    <span class="text-body2 text-orange q-ml-md">当前: {{ localParams.baseSensitivity.toFixed(1) }}x</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制普通滑动操作时节点的移动灵敏度<br/>
                    <strong>放大效果：</strong>滑动时节点旋转更快、移动距离更大，响应更灵敏，需要更少的滑动距离就能旋转到位<br/>
                    <strong>缩小效果：</strong>滑动时节点旋转更慢、移动距离更小，响应更迟钝，需要更多的滑动距离才能旋转到位
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.baseSensitivity"
                :min="0.5"
                :max="3.0"
                :step="0.1"
                label
                :label-value="`${localParams.baseSensitivity.toFixed(1)}x`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetBaseSensitivity"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.baseSensitivity.toFixed(1) }}x</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 快速滑动灵敏度倍数 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="speed" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">快速滑动灵敏度倍数</div>
                    <span class="text-body2 text-orange q-ml-md">当前: {{ localParams.fastSensitivity.toFixed(1) }}x</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    控制快速滑动操作时节点的移动灵敏度<br/>
                    <strong>放大效果：</strong>快速滑动时节点旋转更快，惯性效果更明显，旋转幅度更大<br/>
                    <strong>缩小效果：</strong>快速滑动时节点旋转更慢，惯性效果减弱，旋转幅度更小
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.fastSensitivity"
                :min="1.0"
                :max="5.0"
                :step="0.1"
                label
                :label-value="`${localParams.fastSensitivity.toFixed(1)}x`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetFastSensitivity"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.fastSensitivity.toFixed(1) }}x</span>
              </div>
              </q-card-section>
            </q-card>

            <!-- 滑动速度阈值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="threshold" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">滑动速度阈值 (像素/毫秒)</div>
                    <span class="text-body2 text-orange q-ml-md">当前: {{ localParams.swipeThreshold.toFixed(1) }} px/ms</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    判断滑动是否为快速滑动的速度标准，超过此值将使用快速灵敏度<br/>
                    <strong>放大效果：</strong>更容易触发快速滑动模式，轻微快速滑动就会被识别为快速滑动，使用快速灵敏度<br/>
                    <strong>缩小效果：</strong>需要更快的滑动才能触发快速滑动模式，普通滑动不会触发，使用基础灵敏度
                  </div>
                </div>
              </div>
              <q-slider
                v-model="localParams.swipeThreshold"
                :min="0.1"
                :max="2.0"
                :step="0.1"
                label
                :label-value="`${localParams.swipeThreshold.toFixed(1)} px/ms`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetSwipeThreshold"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.swipeThreshold.toFixed(1) }} px/ms</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>

        <!-- 拖拽参数 -->
        <q-expansion-item
          icon="pan_tool"
          label="拖拽参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 拖拽阈值 -->
            <q-card flat bordered class="q-mb-md parameter-card">
              <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="gesture" class="q-mr-sm" />
                <div class="col">
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">拖拽阈值 (像素)</div>
                    <span class="text-body2 text-purple q-ml-md">当前: {{ localParams.dragThreshold }}px</span>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    判断是否为拖拽操作的最小移动距离，小于此值的移动将被忽略<br/>
                    <strong>放大效果：</strong>需要移动更远距离才触发拖拽，小幅度移动会被忽略，减少误触，适合精确操作<br/>
                    <strong>缩小效果：</strong>只需移动很小距离就触发拖拽，轻微移动就会响应，更敏感但可能误触，适合快速操作
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
                color="purple"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetDragThreshold"
                />
                <span class="text-caption text-grey-6">默认: {{ defaultParams.dragThreshold }}px</span>
              </div>
              </q-card-section>
            </q-card>
          </q-card-section>
        </q-expansion-item>
      </q-card-section>

      <!-- 操作按钮 -->
      <q-card-section class="q-pt-md">
          <div class="row q-gutter-sm">
            <q-btn
              outline
              color="primary"
              icon="refresh"
              label="重置所有参数"
              @click="resetAllParams"
              size="sm"
            />
            <q-btn
              outline
              color="secondary"
              icon="save"
              label="保存到本地"
              @click="saveToLocalStorage"
              size="sm"
            />
            <q-btn
              outline
              color="positive"
              icon="restore"
              label="从本地加载"
              @click="loadFromLocalStorage"
              size="sm"
            />
          </div>
        </q-card-section>

        <!-- ========== 节点管理 ========== -->
        <q-separator class="q-my-md" />
        <div class="text-subtitle2 text-weight-bold q-mb-sm" style="color: #f57c00;">
          🔧 节点管理
        </div>

        <!-- 节点管理区域 -->
        <q-expansion-item
          icon="account_tree"
          label="知识图谱节点控制"
          default-opened
          class="q-mb-sm"
        >
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
                    @update:expanded="(val) => { expandedNodes = [...val] }"
                    :selected="selectedNode"
                    @update:selected="(val) => { selectedNode = val }"
                    default-expand-all
                  >
                    <template v-slot:default-header="prop">
                      <div class="row items-center full-width" style="gap: 8px;">
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

        <!-- 知识图谱角度信息表格 -->
        <q-separator class="q-my-md" />
        <q-card-section>
          <q-expansion-item
            icon="table_chart"
            label="知识图谱角度信息"
            default-opened
            class="q-mb-sm"
          >
            <q-card-section>
              <q-table
                :rows="angleTableRows"
                :columns="angleTableColumns"
                row-key="id"
                flat
                bordered
                dense
                :loading="angleTableLoading"
                class="angle-info-table"
              >
                <template v-slot:body-cell-name="props">
                  <q-td :props="props">
                    <div class="text-weight-medium">{{ props.value }}</div>
                  </q-td>
                </template>
                <template v-slot:body-cell-targetAngle="props">
                  <q-td :props="props">
                    <span class="text-primary">{{ props.value.toFixed(1) }}°</span>
                  </q-td>
                </template>
                <template v-slot:body-cell-currentAngle="props">
                  <q-td :props="props">
                    <span class="text-secondary">{{ props.value.toFixed(1) }}°</span>
                  </q-td>
                </template>
                <template v-slot:body-cell-angleDiff="props">
                  <q-td :props="props">
                    <span :class="getAngleDiffClass(props.value)">
                      {{ formatAngleDiff(props.value) }}
                    </span>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-expansion-item>
        </q-card-section>

        <!-- 当前参数显示 -->
        <q-separator class="q-my-md" />
        <q-card-section>
          <q-banner class="bg-info text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="info" size="md" />
            </template>
            <div class="text-subtitle2">当前参数值</div>
            <div class="text-caption">
              radiusX: {{ localParams.radiusX }}px | 
              radiusY: {{ localParams.radiusY }}px<br/>
              基础灵敏度: {{ localParams.baseSensitivity.toFixed(1) }}x | 
              快速灵敏度: {{ localParams.fastSensitivity.toFixed(1) }}x<br/>
              拖拽阈值: {{ localParams.dragThreshold }}px | 
              滑动阈值: {{ localParams.swipeThreshold.toFixed(1) }} px/ms<br/>
              位置动画: {{ localParams.transformDuration.toFixed(1) }}s | 
              透明度动画: {{ localParams.opacityDuration.toFixed(1) }}s<br/>
              缓动函数: cubic-bezier({{ localParams.easingX1.toFixed(2) }}, {{ localParams.easingY1.toFixed(2) }}, {{ localParams.easingX2.toFixed(2) }}, {{ localParams.easingY2.toFixed(2) }})
            </div>
          </q-banner>
        </q-card-section>
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
          :rules="[val => !!val || '请输入节点名称']"
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
          :rules="[val => val !== null && val !== undefined || '请输入层级']"
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
          :rules="[val => !!val || '请输入节点名称']"
          class="q-mb-md"
        />
        <q-input
          v-model="editingNode.id"
          label="节点ID"
          outlined
          dense
          readonly
          class="q-mb-md"
        />
        <q-input
          v-model.number="editingNode.level"
          type="number"
          label="层级"
          outlined
          dense
          :rules="[val => val !== null && val !== undefined || '请输入层级']"
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
          :rules="[val => !!val || '请输入节点名称']"
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
          :rules="[val => val !== null && val !== undefined || '请输入层级']"
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'

// 定义参数接口
export interface KnowledgeGraphDebugParams {
  radiusX: number
  radiusY: number
  baseSensitivity: number
  fastSensitivity: number
  swipeThreshold: number
  dragThreshold: number
  minBackgroundRadius: number
  radiusScaleSmall: number
  radiusScaleMedium: number
  radiusScaleLarge: number
  // 动画参数
  transformDuration: number
  opacityDuration: number
  easingX1: number
  easingY1: number
  easingX2: number
  easingY2: number
  animationDelayFactor: number
  backgroundTransitionDurationClockwise: number
  backgroundTransitionDurationCounterclockwise: number
  // 角度参数
  targetAngle: number // 目标角度（度），用于自动定位
  influenceRange: number // 影响范围（弧度），展开图谱周围的影响范围
  maxPushAngle: number // 最大推开角度（弧度），其他节点被推开的最大角度
  // 动画时长参数
  expandingRotationDuration: number // 展开旋转动画持续时间（毫秒）
  debounceDelay: number // 防抖延迟（毫秒）
  // 透明度参数
  opacityExpanded: number // 展开的知识图谱透明度
  opacityNearMin: number // 距离相关透明度最小值
  opacityNearFactor: number // 距离相关透明度因子
  opacityFar: number // 距离较远节点透明度
  opacityDefault: number // 默认状态下透明度
  // 缩放参数
  scaleFactor: number // 缩放因子，控制距离相关的缩放幅度
  // 尺寸参数
  graphSize: number // 图形尺寸（像素）
  graphMargin: number // 图形位置偏移（像素）
  // 旋转计算参数
  rotationCoefficient: number // 旋转计算系数，控制旋转角度与滑动距离的比例
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
  defaultParams: () => ({})
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:params': [params: KnowledgeGraphDebugParams]
  'update:nodes': [action: 'add' | 'update' | 'delete', nodeType: 'center' | 'circular', node: ChapterNode, oldNode?: ChapterNode]
}>()

// 使用传入的默认参数值
const defaultParams = computed(() => props.defaultParams)

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const localParams = ref<KnowledgeGraphDebugParams>({
  ...defaultParams.value,
  ...props.params
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
    return props.currentChapter.children.filter(child => child.level === 1) || []
  } else if (currentLevel === 1) {
    // 子章节，显示level=2的子节点
    return props.currentChapter.children.filter(child => child.level === 2) || []
  }
  return props.currentChapter.children || []
})

// 树形数据结构
interface TreeNode extends ChapterNode {
  nodeType?: 'center' | 'circular'
  label: string
}

// 递归转换节点为树形结构
const convertNodeToTreeNode = (node: ChapterNode, nodeType: 'center' | 'circular' = 'circular'): TreeNode => {
  const treeNode: TreeNode = {
    ...node,
    nodeType,
    label: node.label || node.name,
    children: node.children && node.children.length > 0 
      ? node.children.map(child => convertNodeToTreeNode(child, 'circular'))
      : undefined
  }
  return treeNode
}

// 树形数据
const treeData = computed<TreeNode[]>(() => {
  if (!centerNode.value) {
    return []
  }
  
  const rootNode = convertNodeToTreeNode(centerNode.value, 'center')
  
  // 如果有子节点，将它们添加到根节点的 children 中
  if (circularNodes.value.length > 0) {
    rootNode.children = [
      ...(rootNode.children || []),
      ...circularNodes.value.map(node => convertNodeToTreeNode(node, 'circular'))
    ]
  }
  
  return [rootNode]
})

// 树形组件状态
const expandedNodes = ref<string[]>([])
const selectedNode = ref<string | null>(null)

// 监听中心节点变化，自动展开
watch(() => centerNode.value?.id, (newId) => {
  if (newId) {
    expandedNodes.value = [newId]
    selectedNode.value = newId
  }
}, { immediate: true })

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
  children: []
})

const editingCenterNode = ref<ChapterNode>({
  id: '',
  name: '',
  level: null,
  label: '',
  isRoot: false,
  updateTime: '',
  children: []
})

// 监听外部参数变化
watch(() => props.params, (newParams) => {
  if (newParams && Object.keys(newParams).length > 0) {
    localParams.value = { ...localParams.value, ...newParams }
  }
}, { deep: true })

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
  const newNodeLevelValue = newNodeLevel.value ?? (parentLevel + 1)
  
  const newNode: ChapterNode = {
    id: newNodeId.value.trim() || generateNodeId(),
    name: newNodeName.value.trim(),
    level: newNodeLevelValue,
    label: newNodeName.value.trim(),
    children: [],
    isRoot: false,
    updateTime: new Date().toISOString(),
    parentId: parentId
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
    parentId: node.parentId || props.currentChapter?.id || null
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
  const node = circularNodes.value.find(n => n.id === nodeId)
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
    updateTime: new Date().toISOString()
  }
  
  // 查找原始节点
  const originalNode = circularNodes.value.find(n => n.id === editingNode.value.id)
  
  emit('update:nodes', 'update', 'circular', updatedNode, originalNode)
  
  showEditCircularNodeDialog.value = false
  editingNode.value = { id: '', name: '', level: null, isRoot: false, updateTime: '', label: '' }
}

// 删除圆周节点
const deleteCircularNode = (nodeId: string) => {
  const node = circularNodes.value.find(n => n.id === nodeId)
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
    parentId: centerNode.value.parentId || null
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
    updateTime: new Date().toISOString()
  }
  
  emit('update:nodes', 'update', 'center', updatedNode, centerNode.value || undefined)
  
  showEditCenterNodeDialog.value = false
  editingCenterNode.value = { id: '', name: '', level: null, isRoot: false, updateTime: '', label: '' }
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

const resetBaseSensitivity = () => {
  localParams.value.baseSensitivity = defaultParams.value.baseSensitivity
  updateParams()
}

const resetFastSensitivity = () => {
  localParams.value.fastSensitivity = defaultParams.value.fastSensitivity
  updateParams()
}

const resetSwipeThreshold = () => {
  localParams.value.swipeThreshold = defaultParams.value.swipeThreshold
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
  localParams.value.backgroundTransitionDurationClockwise = defaultParams.value.backgroundTransitionDurationClockwise
  updateParams()
}

const resetBackgroundTransitionDurationCounterclockwise = () => {
  localParams.value.backgroundTransitionDurationCounterclockwise = defaultParams.value.backgroundTransitionDurationCounterclockwise
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

const resetRotationCoefficient = () => {
  localParams.value.rotationCoefficient = defaultParams.value.rotationCoefficient
  updateParams()
}

const resetAllParams = () => {
  localParams.value = { ...defaultParams.value }
  updateParams()
}

// 保存到本地存储
const saveToLocalStorage = () => {
  try {
    localStorage.setItem('knowledgeGraphDebugParams', JSON.stringify(localParams.value))
    console.log('✅ 参数已保存到本地存储')
  } catch (error) {
    console.error('❌ 保存参数失败:', error)
  }
}

// 从本地存储加载
const loadFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('knowledgeGraphDebugParams')
    if (saved) {
      const parsed = JSON.parse(saved)
      localParams.value = { ...defaultParams.value, ...parsed }
      updateParams()
      console.log('✅ 参数已从本地存储加载')
    } else {
      console.log('ℹ️ 本地存储中没有保存的参数')
    }
  } catch (error) {
    console.error('❌ 加载参数失败:', error)
  }
}

// 注入知识图谱角度数据
const angleData = inject<{
  selectedChapterDetails: { value: ChapterNode | null }
  getSubChapters: (chapterDetails: ChapterNode | null) => ChapterNode[]
  calculateCircularTrackAngle: (index: number, total: number) => { baseAngle: number; currentAngle: number }
  getChapterRotation: (chapterIndex: number) => number
  getCurrentChapter: () => number
} | undefined>('knowledgeGraphAngleData')

// 角度表格列定义
const angleTableColumns = [
  {
    name: 'name',
    label: '图谱名称',
    field: 'name',
    align: 'left' as const,
    sortable: true
  },
  {
    name: 'targetAngle',
    label: '目标角度',
    field: 'targetAngle',
    align: 'center' as const,
    sortable: true
  },
  {
    name: 'currentAngle',
    label: '实时角度',
    field: 'currentAngle',
    align: 'center' as const,
    sortable: true
  },
  {
    name: 'angleDiff',
    label: '角度差',
    field: 'angleDiff',
    align: 'center' as const,
    sortable: true
  }
]

// 角度表格数据
const angleTableLoading = ref(false)
const angleTableRows = ref<Array<{
  id: string
  name: string
  targetAngle: number
  currentAngle: number
  angleDiff: number
}>>([])

// 更新角度表格数据
const updateAngleTable = () => {
  if (!angleData) {
    angleTableRows.value = []
    return
  }

  const chapterDetails = angleData.selectedChapterDetails.value
  if (!chapterDetails) {
    angleTableRows.value = []
    return
  }

  const subChapters = angleData.getSubChapters(chapterDetails)
  if (subChapters.length === 0) {
    angleTableRows.value = []
    return
  }

  const total = subChapters.length
  const rows = subChapters.map((subChapter, index) => {
    const { baseAngle, currentAngle: currentAngleRadians } = angleData.calculateCircularTrackAngle(index, total)
    
    // 将角度转换为度数（0-360度）
    const targetAngleDegrees = (baseAngle * 180 / Math.PI) % 360
    const targetAngleNormalized = targetAngleDegrees < 0 ? targetAngleDegrees + 360 : targetAngleDegrees
    
    const currentAngleDegrees = (currentAngleRadians * 180 / Math.PI) % 360
    const currentAngleNormalized = currentAngleDegrees < 0 ? currentAngleDegrees + 360 : currentAngleDegrees
    
    // 计算角度差（考虑360度循环，取最小差值）
    let angleDiff = currentAngleNormalized - targetAngleNormalized
    if (angleDiff > 180) angleDiff -= 360
    if (angleDiff < -180) angleDiff += 360
    
    return {
      id: subChapter.id,
      name: subChapter.name || `图谱 ${index + 1}`,
      targetAngle: targetAngleNormalized,
      currentAngle: currentAngleNormalized,
      angleDiff
    }
  })

  angleTableRows.value = rows
}

// 格式化角度差显示
const formatAngleDiff = (diff: number): string => {
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}°`
}

// 根据角度差获取样式类
const getAngleDiffClass = (diff: number): string => {
  const absDiff = Math.abs(diff)
  if (absDiff < 1) return 'text-positive'
  if (absDiff < 5) return 'text-warning'
  return 'text-negative'
}

// 定时器引用
let angleUpdateTimer: NodeJS.Timeout | null = null

// 监听章节详情变化和参数变化，更新角度表格
watch(
  [
    () => angleData?.selectedChapterDetails.value,
    () => localParams.value.targetAngle,
    () => angleData?.getChapterRotation(angleData?.getCurrentChapter() ?? 0)
  ],
  () => {
    updateAngleTable()
  },
  { deep: true, immediate: true }
)

// 设置定时器实时更新角度
onMounted(() => {
  loadFromLocalStorage()
  updateAngleTable()
  
  // 每100ms更新一次角度（实时更新）
  angleUpdateTimer = setInterval(() => {
    updateAngleTable()
  }, 100)
})

// 清理定时器
onUnmounted(() => {
  if (angleUpdateTimer) {
    clearInterval(angleUpdateTimer)
    angleUpdateTimer = null
  }
})
</script>

<style lang="scss" scoped>
.angle-info-table {
  font-size: 0.875rem;
  
  :deep(.q-table__top) {
    padding: 8px;
  }
  
  :deep(.q-table tbody td) {
    padding: 8px 12px;
  }
  
  :deep(.q-table thead th) {
    font-weight: 600;
    font-size: 0.875rem;
    padding: 8px 12px;
  }
}

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
    width: 380px;
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
</style>
