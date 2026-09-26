import { LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import type { ApiPromptCategory, ApiPromptTemplate, ApiPromptTemplateDetail, ApiPromptVersion } from "../../api/client";
import { Button } from "../ui/button";
import { PromptInfoTab } from "./tabs/PromptInfoTab";
import { PromptVersionHistoryTab } from "./tabs/PromptVersionHistoryTab";
import { PromptTestTab } from "./tabs/PromptTestTab";
import { PromptCompareTab } from "./tabs/PromptCompareTab";

interface PromptDetailPanelProps {
  template: ApiPromptTemplateDetail | null;
  selectedItem: ApiPromptTemplate | null;
  detailStatus: "idle" | "loading" | "ready" | "error";
  detailError: string;
  activeTabOverride?: "info" | "versions" | "test" | "compare" | null;
  onClose: () => void;
  onRetry: () => void;
  categories: ApiPromptCategory[];
  onCreateCategory: (name: string) => Promise<ApiPromptCategory | null>;
  onSaveNewVersion: (templateId: string, baseVersionId: string, data: { body: string; userPromptTemplate: string; changeNote: string; generationParams: Record<string, any> }) => Promise<void>;
  onUpdateTemplate?: (templateId: string, data: { name?: string; kindName?: string; categoryId?: string | null }) => Promise<void>;
  onSetDefaultVersion?: (templateId: string, versionId: string) => Promise<void>;
}

type TabType = "info" | "versions" | "test" | "compare";

export function PromptDetailPanel({ template, selectedItem, detailStatus, detailError, activeTabOverride, onClose, onRetry, categories, onCreateCategory, onSaveNewVersion, onUpdateTemplate, onSetDefaultVersion }: PromptDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [editingVersion, setEditingVersion] = useState<ApiPromptVersion | null>(null);

  // 当 activeTabOverride 改变时，切换到指定的 tab
  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  if (!template) {
    return (
      <aside className="prompt-detail-panel">
        {selectedItem ? <>
          <div className="prompt-detail-header">
            <div><strong>{selectedItem.name}</strong><span>{selectedItem.code}</span></div>
            <button className="prompt-detail-close" onClick={onClose} aria-label="关闭">×</button>
          </div>
          <div className="prompt-detail-empty prompt-detail-state">
            {detailStatus === "loading" ? <><LoaderCircle className="spin" size={20} /><p role="status">正在加载提示词详情...</p></> : <><p role="alert">{detailError || "提示词详情加载失败"}</p><Button size="sm" variant="secondary" onClick={onRetry}><RefreshCw size={14} />重试</Button></>}
          </div>
        </> : <div className="prompt-detail-empty"><p>选择一个提示词查看详情</p></div>}
      </aside>
    );
  }

  const handleSaveNewVersion = async (data: { body: string; userPromptTemplate: string; changeNote: string; generationParams: Record<string, any> }) => {
    // 使用 editingVersion 如果存在，否则使用 defaultVersion
    const baseVersion = editingVersion || template.defaultVersion;
    if (!baseVersion) {
      throw new Error("没有默认版本");
    }
    await onSaveNewVersion(template.id, baseVersion.id, data);
    setEditingVersion(null);
  };

  const handleUpdateTemplate = async (data: { name?: string; kindName?: string; categoryId?: string | null }) => {
    if (!template) return;
    await onUpdateTemplate?.(template.id, data);
  };

  const handleEditVersion = async (version: ApiPromptVersion) => {
    // 切换到基本信息 Tab 并进入编辑模式，预填充该版本的内容
    setEditingVersion(version);
    setActiveTab("info");
  };

  const handleSetDefaultVersion = async (version: ApiPromptVersion) => {
    if (!template) return;
    await onSetDefaultVersion?.(template.id, version.id);
  };

  const handleDuplicateVersion = async (version: ApiPromptVersion) => {
    // 基于选中的版本创建新版本
    await onSaveNewVersion(template.id, version.id, {
      body: version.body,
      userPromptTemplate: version.userPromptTemplate,
      changeNote: `基于 v${version.versionNo} 创建`,
      generationParams: version.generationParams || {}
    });
  };

  return (
    <aside className="prompt-detail-panel">
      <div className="prompt-detail-header">
        <div>
          <strong>{template.name}</strong>
          <span>{template.code}</span>
        </div>
        <button className="prompt-detail-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <nav className="prompt-detail-tabs">
        <button
          className={`prompt-detail-tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          基本信息
        </button>
        <button
          className={`prompt-detail-tab ${activeTab === "versions" ? "active" : ""}`}
          onClick={() => setActiveTab("versions")}
        >
          版本历史
        </button>
        <button
          className={`prompt-detail-tab ${activeTab === "test" ? "active" : ""}`}
          onClick={() => setActiveTab("test")}
        >
          快速测试
        </button>
        <button
          className={`prompt-detail-tab ${activeTab === "compare" ? "active" : ""}`}
          onClick={() => setActiveTab("compare")}
        >
          对比分析
        </button>
      </nav>

      <div className="prompt-detail-content">
        {detailStatus === "loading" && <div className="prompt-detail-refresh" role="status"><LoaderCircle className="spin" size={14} />正在更新详情...</div>}
        {detailStatus === "error" && <div className="prompt-detail-refresh prompt-detail-refresh-error" role="alert"><span>{detailError}</span><Button size="sm" variant="ghost" onClick={onRetry}><RefreshCw size={13} />重试</Button></div>}
        {activeTab === "info" && (
          <PromptInfoTab
            template={template}
            categories={categories}
            onCreateCategory={onCreateCategory}
            editingVersion={editingVersion}
            onSaveNewVersion={handleSaveNewVersion}
            onUpdateTemplate={handleUpdateTemplate}
            onCancelEdit={() => setEditingVersion(null)}
          />
        )}

        {activeTab === "versions" && (
          <PromptVersionHistoryTab
            template={template}
            onEditVersion={handleEditVersion}
            onDuplicateVersion={handleDuplicateVersion}
            onSetDefaultVersion={handleSetDefaultVersion}
          />
        )}

        {activeTab === "test" && (
          <PromptTestTab template={template} />
        )}

        {activeTab === "compare" && (
          <PromptCompareTab template={template} />
        )}
      </div>
    </aside>
  );
}
