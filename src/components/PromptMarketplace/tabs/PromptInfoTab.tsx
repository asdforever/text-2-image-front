import { useState, useEffect } from "react";
import { Edit3, Save, X, FileEdit } from "lucide-react";
import type { ApiPromptCategory, ApiPromptTemplateDetail, ApiPromptVersion } from "../../../api/client";
import { Button } from "../../ui/button";

interface PromptInfoTabProps {
  template: ApiPromptTemplateDetail;
  categories: ApiPromptCategory[];
  onCreateCategory: (name: string) => Promise<ApiPromptCategory | null>;
  editingVersion?: ApiPromptVersion | null;
  onSaveNewVersion: (data: { body: string; userPromptTemplate: string; changeNote: string; generationParams: Record<string, any> }) => Promise<void>;
  onUpdateTemplate?: (data: { name?: string; kindName?: string; categoryId?: string | null }) => Promise<void>;
  onCancelEdit?: () => void;
}

export function PromptInfoTab({ template, categories, onCreateCategory, editingVersion, onSaveNewVersion, onUpdateTemplate, onCancelEdit }: PromptInfoTabProps) {
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [body, setBody] = useState(template.defaultVersion?.body || "");
  const [userPromptTemplate, setUserPromptTemplate] = useState(template.defaultVersion?.userPromptTemplate || "");
  const [changeNote, setChangeNote] = useState("");
  const [templateName, setTemplateName] = useState(template.name);
  const [templateCategoryId, setTemplateCategoryId] = useState(template.categoryId || "");
  const [generationParams, setGenerationParams] = useState<Record<string, any>>(
    template.defaultVersion?.generationParams || {}
  );
  const [saving, setSaving] = useState(false);

  // 当 editingVersion 改变时，自动进入编辑模式并预填充内容
  useEffect(() => {
    if (editingVersion) {
      setBody(editingVersion.body);
      setUserPromptTemplate(editingVersion.userPromptTemplate);
      setChangeNote(`基于 v${editingVersion.versionNo} 创建`);
      setGenerationParams(editingVersion.generationParams || {});
      setIsEditingVersion(true);
    }
  }, [editingVersion]);

  const handleEditVersion = () => {
    setBody(template.defaultVersion?.body || "");
    setUserPromptTemplate(template.defaultVersion?.userPromptTemplate || "");
    setChangeNote("");
    setGenerationParams(template.defaultVersion?.generationParams || {});
    setIsEditingVersion(true);
  };

  const handleEditInfo = () => {
    setTemplateName(template.name);
    setTemplateCategoryId(template.categoryId || "");
    setIsEditingInfo(true);
  };

  const handleCancelVersion = () => {
    setIsEditingVersion(false);
    setBody(template.defaultVersion?.body || "");
    setUserPromptTemplate(template.defaultVersion?.userPromptTemplate || "");
    setChangeNote("");
    setGenerationParams(template.defaultVersion?.generationParams || {});
    onCancelEdit?.();
  };

  const handleCancelInfo = () => {
    setIsEditingInfo(false);
    setTemplateName(template.name);
    setTemplateCategoryId(template.categoryId || "");
  };

  const handleSaveVersion = async () => {
    if (!body.trim()) {
      alert("System Prompt 不能为空");
      return;
    }

    setSaving(true);
    try {
      await onSaveNewVersion({ body, userPromptTemplate, changeNote, generationParams });
      setIsEditingVersion(false);
      setChangeNote("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!templateName.trim()) {
      alert("名称不能为空");
      return;
    }

    setSaving(true);
    try {
      await onUpdateTemplate?.({ name: templateName.trim(), categoryId: templateCategoryId || null });
      setIsEditingInfo(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!template.defaultVersion) {
    return (
      <div className="prompt-tab-placeholder">
        <p>暂无默认版本</p>
      </div>
    );
  }

  return (
    <div className="prompt-info-tab">
      {!isEditingVersion && !isEditingInfo && (
        <div className="prompt-info-toolbar">
          <Button variant="ghost" size="sm" onClick={handleEditInfo}>
            <FileEdit size={13} />
            编辑基本信息
          </Button>
          <Button variant="secondary" size="sm" onClick={handleEditVersion}>
            <Edit3 size={13} />
            编辑并创建新版本
          </Button>
        </div>
      )}

      <div className="prompt-info-content">
        {template.defaultVersion.applicability?.runtimeRole === "style-seed" && <div className="prompt-info-section"><label>工作台风格</label><span>此模板的默认版本用于新任务。编辑并保存版本后，新编译使用更新后的风格；已编译批次保留原版本。</span></div>}
        <div className="prompt-info-section">
          <label>Code</label>
          <span>{template.code}</span>
        </div>

        <div className="prompt-info-section">
          <label>名称</label>
          {isEditingInfo ? (
            <input
              type="text"
              className="prompt-edit-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          ) : (
            <span>{template.name}</span>
          )}
        </div>

        <div className="prompt-info-section">
          <label>业务分类</label>
          {isEditingInfo ? <div className="prompt-category-edit"><select className="prompt-edit-input" value={templateCategoryId} onChange={(event) => { if (event.target.value !== "__create__") setTemplateCategoryId(event.target.value); else { const name = window.prompt("新建分类名称"); if (name) void onCreateCategory(name).then((category) => { if (category) setTemplateCategoryId(category.id); }); } }}><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="__create__">+ 新建分类</option></select></div> : <span>{template.categoryName || "未分类"}</span>}
        </div>

        <div className="prompt-info-section">
          <label>执行目标</label>
          <span>{template.executionTarget}</span>
        </div>

        <div className="prompt-info-section">
          <label>当前版本</label>
          <span>v{template.defaultVersion.versionNo}</span>
        </div>

        <div className="prompt-info-section">
          <label>System Prompt</label>
          {isEditingVersion ? (
            <textarea
              className="prompt-edit-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="描述模型应遵循的系统行为和输出要求"
            />
          ) : (
            <pre className="prompt-info-body">{template.defaultVersion.body}</pre>
          )}
        </div>

        <div className="prompt-info-section">
          <label>User Prompt Template</label>
          {isEditingVersion ? (
            <textarea
              className="prompt-edit-textarea"
              value={userPromptTemplate}
              onChange={(e) => setUserPromptTemplate(e.target.value)}
              rows={6}
              placeholder="可选：定义传给模型的用户提示词模板"
            />
          ) : template.defaultVersion.userPromptTemplate ? (
            <pre className="prompt-info-body">{template.defaultVersion.userPromptTemplate}</pre>
          ) : (
            <span className="prompt-info-empty">未设置</span>
          )}
        </div>

        {isEditingVersion && template.executionTarget === "image_model" && (
          <>
            <div className="prompt-info-section">
              <label>图片尺寸 (size)</label>
              <select
                className="prompt-edit-input"
                value={generationParams.size || "1024x1024"}
                onChange={(e) => setGenerationParams({ ...generationParams, size: e.target.value })}
              >
                <option value="1024x1024">1024x1024</option>
                <option value="1792x1024">1792x1024</option>
                <option value="1024x1792">1024x1792</option>
              </select>
            </div>

            <div className="prompt-info-section">
              <label>质量 (quality)</label>
              <select
                className="prompt-edit-input"
                value={generationParams.quality || "standard"}
                onChange={(e) => setGenerationParams({ ...generationParams, quality: e.target.value })}
              >
                <option value="">默认</option>
                <option value="standard">standard</option>
                <option value="hd">hd</option>
              </select>
            </div>

            <div className="prompt-info-section">
              <label>风格 (style)</label>
              <select
                className="prompt-edit-input"
                value={generationParams.style || ""}
                onChange={(e) => setGenerationParams({ ...generationParams, style: e.target.value })}
              >
                <option value="">默认</option>
                <option value="vivid">vivid</option>
                <option value="natural">natural</option>
              </select>
            </div>

            <div className="prompt-info-section">
              <label>随机种子 (seed)</label>
              <input
                type="number"
                className="prompt-edit-input"
                value={generationParams.seed || ""}
                onChange={(e) => setGenerationParams({ ...generationParams, seed: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="可选：固定随机种子以获得可重复的结果"
              />
            </div>
          </>
        )}

        {isEditingVersion && (
          <div className="prompt-info-section">
            <label>修改说明</label>
            <input
              type="text"
              className="prompt-edit-input"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="简要说明本次修改的内容（可选）"
            />
          </div>
        )}
      </div>

      {isEditingVersion && (
        <div className="prompt-info-actions">
          <Button variant="secondary" onClick={handleCancelVersion} disabled={saving}>
            <X size={13} />
            取消
          </Button>
          <Button onClick={handleSaveVersion} disabled={saving}>
            <Save size={13} />
            {saving ? "保存中..." : "保存为新版本"}
          </Button>
        </div>
      )}

      {isEditingInfo && (
        <div className="prompt-info-actions">
          <Button variant="secondary" onClick={handleCancelInfo} disabled={saving}>
            <X size={13} />
            取消
          </Button>
          <Button onClick={handleSaveInfo} disabled={saving}>
            <Save size={13} />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      )}
    </div>
  );
}
