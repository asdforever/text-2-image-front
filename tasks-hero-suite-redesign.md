# 主图和详情套图界面重构任务清单

## 参考设计说明

### 主图生成界面（第一张参考图）
- **左侧配置区**：
  - 产品素材上传区（显示"上传消耗8张图片"）
  - 创作指令（专业版）输入框，支持详细的文本输入
- **右侧结果区**：
  - 标签页切换：图片 / 富文本 Beta / 内测版
  - 大面积结果展示区

### 详情套图生成界面（第二张参考图）
- **左侧配置区**：
  - 产品素材选择
  - 组件编号选择（选择第几张组件）
  - 创作指令输入（长文本框，支持2000字）
  - 输出样式选择（中文等）
  - 尺寸和宽度配置
  - 电商销售场景预设（丰富的场景标签）
  - 底部生成按钮
- **右侧结果区**：
  - 详情页模块结果展示

---

## 任务分组

### 一、主图工作区重构（HeroImageWorkspace）

#### 1.1 移除现有配置对话框，改为左右布局
- [ ] 删除 `HeroConfigDialog.tsx` 的使用
- [ ] 将 `HeroImageWorkspace` 改为左右双栏布局（`.hero-workspace`）
  - 左侧配置面板 `.config-panel`（固定宽度 360px）
  - 右侧结果区 `.result-canvas`（弹性占据剩余空间）

#### 1.2 左侧配置面板实现
- [ ] **产品素材区块**
  - 标题："产品素材"
  - 副标题："上传消耗的8张图片"
  - 大尺寸上传区域（虚线边框）
  - 提示文字："图片不是越多越好，上传必要的几张即可。"
  - 辅助说明："生成过的组图会保存在这里，不必再一键复用、不用重新上传。"
  - 缩略图网格显示已选择的白底图

- [ ] **创作指令区块（专业版）**
  - 标题："创作指令（专业版）"+ 重置按钮图标
  - 大文本输入框（textarea，最少 200px 高度）
  - 占位符文字："把完整的创作指令写在这里：构图、标题文案、风格、角色更求都含该条指令；支持按『第1张 / 第2张...』逐张指挥，系统只把对应镜落用于对应模块。"
  - 字数统计："最多 2000 字，当前 0/2000"

#### 1.3 右侧结果区实现
- [ ] 顶部标签页切换
  - 图片（默认选中）
  - 富文本 Beta（带 Beta 标签）
  - 内测版（橙色标签）
- [ ] 中间结果展示区
  - 空状态：大图标 + "上传同款商品参考图、填写组图要求并选择详情页模块后，点击"生成详情页规划方案"开始。"
  - 有结果：主图卡片网格展示（保持现有的虚拟滚动列表）
- [ ] 右上角"破起左侧"按钮

#### 1.4 Toolbar 集成
- [ ] 保留左侧工具栏的"主图"按钮和导航
- [ ] 移除"配置"按钮（因为配置已内嵌到工作区左侧）

---

### 二、详情套图工作区重构（SuiteWorkspace）

#### 2.1 左右双栏布局实现
- [ ] 将 `SuiteWorkspace` 改为左右双栏布局（`.suite-workspace`）
  - 左侧配置面板 `.config-panel`（固定宽度 360px）
  - 右侧结果区 `.result-canvas`（弹性占据剩余空间）

#### 2.2 左侧配置面板实现
- [ ] **产品素材区块**
  - 标题："产品素材"
  - 提示："上传或选择产品的白底图"
  - 上传区域（虚线边框，显示上传图标）
  - 提示："图片不是越多越好，上传必要的几张即可。"
  - 已选素材的缩略图网格
  - "素材上传"按钮

- [ ] **组件编号选择**
  - 标题："组件编号"
  - 副标题："选择第几张组件，100张 - 默认全选择"
  - 提示："当前组件编号对应第1张组件，可以后续单独调整页面视觉。"
  - 数字输入框（默认显示"1"）

- [ ] **创作指令输入**
  - 标题："创作指令"
  - 大文本输入框（textarea，高度约 120px）
  - 占位符："把完整的创作指令写在这里：构图、标题文案、风格、角色更求都含该条指令；支持按『第1张 / 第2张...』逐张指挥，系统只把对应镜落用于对应模块。"
  - 字数统计："最多 2000 字，当前 0/2000"

- [ ] **输出样式选择**
  - 标题："输出样式"
  - 下拉选择框，默认"中文"

- [ ] **尺寸配置**
  - 标题："尺寸"
  - 模型选择：下拉框（如 "GFT Image 2.5 Turbo"）
  - 宽度选择：下拉框（如 "1:1 方图"）
  - "详细"按钮

- [ ] **电商销售场景区块**
  - 标题："电商销售场景"
  - 副标题："选择适用于你的促销活动或自定义创作方向，利用即可自动载入促销话术下对应场景。"
  - "保存不经常用"选项
  - 场景标签网格（每个标签是可选择的按钮）：
    - 产品展示、详解展示、减肥纤体
    - 直播商品介、适越健康试、健康生活方式
    - 清洁护肤、彩妆、产品推荐
    - 皮肤健康、美发护发、美容护肤场景
    - 成分展示、使用效果对比、产品卖点突出
    - 家庭场景、室内场景、办公场景
    - 日常生活、功能展示、精致生活家场景
    - 运动场景、健身教练场景、户外运动
    - 母婴产品、安全贴心场景、母婴互动场景
    - 儿童学习、儿童玩耍、家庭亲子场景
    - 宠物互动、宠物关怀、宠物日常生活场景
    - 商务办公、会议场景、职场精英场景
    - 学习成长、知识学习、专注学习场景
    - 潮流时尚、都市生活场景、潮派生活方式场景
    - 传统节日场景、节日庆典场景、节日氛围场景
    - 以及更多...
  - "场景收藏"按钮（可展开）

- [ ] **底部操作区**
  - "组件 KV"按钮
  - "优惠券"按钮
  - "破起推荐"按钮
  - "使用指导"按钮
  - "安全套件"按钮（左侧）
  - "预览"按钮（右侧）
  - "加载打样"按钮（右侧）
  - 主要"生成"按钮（大按钮，底部固定）

#### 2.3 右侧结果区实现
- [ ] 顶部工具栏
  - 标题："详情套图工作区"
  - 副标题："规划并生成详情页套图，支持拖拽排序与导出。"
  - 右上角按钮组：
    - "导出套图 ZIP"按钮（批量导出）
- [ ] 中间画布区域
  - 空状态：大图标 + "暂无套图，请从左侧配置面板开始生成"
  - 有结果：使用 XYFlow 画布展示套图组件
    - 每个节点代表一张套图
    - 支持拖拽重新排序
    - 节点显示预览缩略图 + 标题
    - 节点操作按钮：预览、删除、重新生成
- [ ] 画布工具栏（右下角浮动）
  - 缩放控制
  - 适应画布
  - 网格开关

---

### 三、数据模型与状态管理

#### 3.1 主图数据模型
- [ ] 定义 `HeroGenerationConfig` 类型
  ```typescript
  interface HeroGenerationConfig {
    selectedBaseIds: string[];          // 选择的白底图 IDs
    creativePrompt: string;             // 创作指令（专业版）
    resultTab: 'image' | 'richtext' | 'beta';  // 结果标签页
  }
  ```

#### 3.2 详情套图数据模型
- [ ] 定义 `SuiteGenerationConfig` 类型
  ```typescript
  interface SuiteGenerationConfig {
    selectedBaseIds: string[];          // 选择的产品素材 IDs
    componentNumber: number;            // 组件编号（默认 1）
    creativePrompt: string;             // 创作指令（最多 2000 字）
    outputStyle: string;                // 输出样式（如"中文"）
    model: string;                      // 模型选择
    aspectRatio: string;                // 宽度比例
    selectedScenes: string[];           // 选中的电商场景标签
  }
  ```

- [ ] 定义 `SuiteNode` 类型（用于 XYFlow 画布）
  ```typescript
  interface SuiteNode {
    id: string;
    type: 'suite-card';
    position: { x: number; y: number };
    data: {
      asset: Asset;
      title: string;
      preview: string;
    };
  }
  ```

#### 3.3 Store 更新
- [ ] 在 `useProjectStore` 中添加主图生成配置状态
- [ ] 在 `useProjectStore` 中添加详情套图生成配置状态
- [ ] 添加生成任务跟踪（进度、状态）

---

### 四、样式实现（CSS）

#### 4.1 双栏布局样式
```css
.hero-workspace,
.suite-workspace {
  display: grid;
  grid-template-columns: 360px 1fr;
  height: 100%;
  gap: 0;
}

.config-panel {
  width: 360px;
  height: 100%;
  overflow-y: auto;
  background: var(--surface-2);
  border-right: 1px solid var(--border-color);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.result-canvas {
  flex: 1;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

#### 4.2 配置面板区块样式
```css
.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-section p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  background: var(--surface-1);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: var(--accent-color);
  background: var(--surface-2);
}

.creative-prompt-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-1);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}

.char-counter {
  text-align: right;
  font-size: 11px;
  color: var(--text-tertiary);
}
```

#### 4.3 场景标签网格样式
```css
.scene-tags-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.scene-tag {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--surface-1);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.scene-tag:hover {
  border-color: var(--accent-color);
  background: var(--surface-2);
}

.scene-tag.selected {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: white;
}
```

#### 4.4 结果标签页样式
```css
.result-tabs {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.result-tab {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.result-tab:hover {
  color: var(--text-primary);
}

.result-tab.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.result-tab .beta-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  background: var(--accent-color);
  color: white;
  font-size: 10px;
  border-radius: 3px;
}

.result-tab .internal-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  background: #ff8c42;
  color: white;
  font-size: 10px;
  border-radius: 3px;
}
```

---

### 五、组件重构任务

#### 5.1 HeroImageWorkspace 重构
- [ ] 重构文件结构为左右双栏布局
- [ ] 实现左侧配置面板（产品素材 + 创作指令）
- [ ] 实现右侧结果区（标签页 + 主图网格）
- [ ] 移除对 `HeroConfigDialog` 的依赖
- [ ] 状态管理：选择的白底图、创作指令文本、结果标签页

#### 5.2 SuiteWorkspace 重构
- [ ] 重构文件结构为左右双栏布局
- [ ] 实现左侧配置面板（完整表单）
  - 产品素材选择
  - 组件编号输入
  - 创作指令输入
  - 输出样式选择
  - 尺寸配置
  - 电商场景标签网格
  - 底部操作按钮组
- [ ] 实现右侧画布区（XYFlow 集成）
  - 安装依赖：`npm install @xyflow/react`
  - 创建自定义节点类型 `SuiteCardNode`
  - 实现拖拽排序功能
  - 实现画布工具栏（缩放、适应、网格）
- [ ] 状态管理：配置参数、套图节点列表、画布视口状态

#### 5.3 移除旧组件
- [ ] 删除 `HeroConfigDialog.tsx`（已被左侧面板替代）
- [ ] 删除 `HeroConfigPanel.tsx`（如果存在）

---

### 六、API 与 Mock 数据

#### 6.1 主图生成 API
- [ ] 定义 `/api/projects/:id/hero/generate` 接口
- [ ] 请求参数：`selectedBaseIds`, `creativePrompt`
- [ ] 响应数据：生成的主图资产列表
- [ ] Mock 实现：`mockGenerateHeroFromPrompt`

#### 6.2 详情套图生成 API
- [ ] 定义 `/api/projects/:id/suite/generate` 接口
- [ ] 请求参数：完整的 `SuiteGenerationConfig`
- [ ] 响应数据：生成的套图资产列表
- [ ] Mock 实现：`mockGenerateSuiteFromConfig`

#### 6.3 场景预设数据
- [ ] 创建 `src/data/ecommerce-scenes.ts`
- [ ] 定义所有电商场景标签的常量数组
- [ ] 分类：产品展示、健康美容、家居生活、运动健身、母婴、宠物、商务、节日等

---

### 七、集成与验证

#### 7.1 主图工作区验证
- [ ] 可以选择多张白底图
- [ ] 可以输入创作指令（长文本）
- [ ] 可以切换结果标签页（图片 / 富文本 / 内测版）
- [ ] 点击生成后显示生成进度
- [ ] 生成完成后在右侧网格展示主图
- [ ] 可以单独重新生成某张主图
- [ ] 可以导出选中的主图

#### 7.2 详情套图工作区验证
- [ ] 可以选择产品素材
- [ ] 可以输入组件编号和创作指令
- [ ] 可以选择输出样式和尺寸
- [ ] 可以选择多个电商场景标签
- [ ] 点击生成后在右侧画布显示节点
- [ ] 可以拖拽节点重新排序
- [ ] 可以缩放和平移画布
- [ ] 可以预览单个套图
- [ ] 可以导出整套图片为 ZIP

#### 7.3 左侧工具栏验证
- [ ] 点击"主图"按钮跳转到主图工作区
- [ ] 点击"套图"按钮跳转到详情套图工作区
- [ ] 工具栏按钮状态正确高亮
- [ ] 移除了独立的"配置"按钮（已内嵌）

---

## 优先级说明

### P0（必须完成）
- 主图工作区左右双栏布局
- 详情套图工作区左右双栏布局
- 左侧配置面板基本表单（素材选择 + 创作指令）
- 右侧结果网格展示

### P1（重要）
- 标签页切换功能
- 电商场景标签网格选择
- XYFlow 画布集成
- 生成任务进度展示

### P2（可延后）
- 富文本 Beta 标签页内容
- 内测版标签页内容
- 高级画布交互（撤销/重做）
- 场景收藏功能

---

## 预估工作量
- 主图工作区重构：4-6 小时
- 详情套图工作区重构：6-8 小时
- XYFlow 画布集成：3-4 小时
- 样式与细节打磨：2-3 小时
- 测试与 Bug 修复：2-3 小时

**总计：17-24 小时**
