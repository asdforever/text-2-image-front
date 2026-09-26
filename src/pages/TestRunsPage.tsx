import { useEffect, useState } from "react";
import { Play, Trash2, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import type { TestRun, CreateTestRunInput } from "../types/asset";
import type { Asset, AssetLibrary } from "../types/asset";
import { listTestRuns, createTestRun, updateTestRun, deleteTestRun } from "../lib/api-asset";
import { listAssetLibraries, listAssets } from "../lib/api-asset";
import { suiteApi } from "../api/client";
import type { ApiPromptTemplate, ApiPromptVersion } from "../api/client";

export function TestRunsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestRun | null>(null);
  const [error, setError] = useState("");

  const [templates, setTemplates] = useState<ApiPromptTemplate[]>([]);
  const [versions, setVersions] = useState<ApiPromptVersion[]>([]);
  const [assetLibraries, setAssetLibraries] = useState<AssetLibrary[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [formTemplateId, setFormTemplateId] = useState("");
  const [formVersionId, setFormVersionId] = useState("");
  const [formInputType, setFormInputType] = useState<"asset" | "text">("asset");
  const [formAssetLibraryId, setFormAssetLibraryId] = useState("");
  const [formAssetId, setFormAssetId] = useState("");
  const [formInputText, setFormInputText] = useState("");

  useEffect(() => {
    void loadRuns();
    void loadTemplates();
    void loadAssetLibraries();
  }, []);

  useEffect(() => {
    if (formTemplateId) {
      void loadVersions(formTemplateId);
    } else {
      setVersions([]);
      setFormVersionId("");
    }
  }, [formTemplateId]);

  useEffect(() => {
    if (formAssetLibraryId) {
      void loadAssets(formAssetLibraryId);
    } else {
      setAssets([]);
      setFormAssetId("");
    }
  }, [formAssetLibraryId]);

  async function loadRuns() {
    try {
      setLoading(true);
      const data = await listTestRuns();
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const data = await suiteApi.listPromptTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载提示词模板失败");
    }
  }

  async function loadVersions(templateId: string) {
    try {
      const data = await suiteApi.listPromptTemplateVersions(templateId);
      setVersions(data);
      if (data.length > 0) {
        setFormVersionId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载版本失败");
    }
  }

  async function loadAssetLibraries() {
    try {
      const data = await listAssetLibraries();
      setAssetLibraries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材库失败");
    }
  }

  async function loadAssets(libraryId: string) {
    try {
      const data = await listAssets(libraryId);
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材失败");
    }
  }

  async function handleCreate() {
    if (!formVersionId) {
      setError("请选择提示词版本");
      return;
    }
    if (formInputType === "asset" && !formAssetId) {
      setError("请选择输入素材");
      return;
    }
    if (formInputType === "text" && !formInputText.trim()) {
      setError("请输入文本");
      return;
    }
    try {
      const input: CreateTestRunInput = {
        promptVersionId: formVersionId,
        inputAssetId: formInputType === "asset" ? formAssetId : undefined,
        inputText: formInputType === "text" ? formInputText.trim() : undefined,
      };
      await createTestRun(input);
      setCreateOpen(false);
      resetForm();
      void loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTestRun(deleteTarget.id);
      setDeleteTarget(null);
      void loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function resetForm() {
    setFormTemplateId("");
    setFormVersionId("");
    setFormInputType("asset");
    setFormAssetLibraryId("");
    setFormAssetId("");
    setFormInputText("");
  }

  function getStatusBadge(status: TestRun["status"]) {
    const icons = {
      pending: <Clock size={12} />,
      running: <Loader2 size={12} className="animate-spin" />,
      completed: <CheckCircle2 size={12} />,
      failed: <XCircle size={12} />,
    };
    const colors = {
      pending: "#8ca0ad",
      running: "#d6ad6c",
      completed: "#61b987",
      failed: "#d66d73",
    };
    const labels = {
      pending: "等待中",
      running: "运行中",
      completed: "已完成",
      failed: "失败",
    };
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: colors[status], fontSize: 10 }}>
        {icons[status]}
        {labels[status]}
      </span>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>测试运行</strong>
          <span>执行提示词测试，记录输入输出</span>
        </div>
      </header>

      <main className="management-page">
        <div className="management-toolbar">
          <div>
            <h1>测试运行</h1>
            <p>使用素材库中的输入数据测试提示词，查看生成结果</p>
          </div>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            <Play size={14} />
            新建测试
          </Button>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : runs.length === 0 ? (
          <div className="empty-state">暂无测试运行，点击上方按钮创建第一个</div>
        ) : (
          <div className="task-list">
            {runs.map((run) => (
              <article key={run.id} className="task-row">
                <div>
                  <strong>测试运行 #{run.id.slice(0, 8)}</strong>
                  <span>
                    提示词版本: {run.promptVersionId.slice(0, 8)} ·{" "}
                    {run.inputAsset
                      ? `素材: ${run.inputAsset.name}`
                      : run.inputText
                        ? `文本: ${run.inputText.slice(0, 30)}...`
                        : "无输入"}
                  </span>
                </div>
                {getStatusBadge(run.status)}
                <div className="task-actions">
                  {run.status === "completed" && run.outputProduct && (
                    <span style={{ fontSize: 10, color: "#89949d" }}>
                      输出: {run.outputProduct.name} ({(run.outputProduct.fileSize / 1024).toFixed(1)} KB)
                    </span>
                  )}
                  {run.status === "failed" && run.errorMessage && (
                    <span style={{ fontSize: 10, color: "#d66d73" }}>{run.errorMessage}</span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(run)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="新建测试运行">
        <div className="dialog-body">
          <div className="form-grid">
            <div className="form-field">
              <label>提示词模板</label>
              <Select value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)}>
                <option value="">选择模板</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.kind})
                  </option>
                ))}
              </Select>
            </div>
            {formTemplateId && (
              <div className="form-field">
                <label>提示词版本</label>
                <Select value={formVersionId} onChange={(e) => setFormVersionId(e.target.value)}>
                  <option value="">选择版本</option>
                  {versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      v{ver.versionNo} - {ver.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="form-field">
              <label>输入类型</label>
              <Select value={formInputType} onChange={(e) => setFormInputType(e.target.value as "asset" | "text")}>
                <option value="asset">素材库素材</option>
                <option value="text">手动输入文本</option>
              </Select>
            </div>
            {formInputType === "asset" ? (
              <>
                <div className="form-field">
                  <label>素材库</label>
                  <Select value={formAssetLibraryId} onChange={(e) => setFormAssetLibraryId(e.target.value)}>
                    <option value="">选择素材库</option>
                    {assetLibraries.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.name} ({lib.assetType})
                      </option>
                    ))}
                  </Select>
                </div>
                {formAssetLibraryId && (
                  <div className="form-field">
                    <label>素材</label>
                    <Select value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)}>
                      <option value="">选择素材</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="form-field">
                <label>输入文本</label>
                <Textarea
                  value={formInputText}
                  onChange={(e) => setFormInputText(e.target.value)}
                  placeholder="输入测试文本"
                  rows={4}
                />
              </div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => void handleCreate()}>
            <Play size={14} />
            创建并运行
          </Button>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(open) => !open && setDeleteTarget(null)} title="确认删除">
          <div className="dialog-body">
            <p style={{ color: "#e6e9eb" }}>确定删除此测试运行？此操作无法恢复。</p>
          </div>
          <div className="dialog-footer">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()}>
              删除
            </Button>
          </div>
        </Dialog>
      )}

      {/* Error Toast */}
      {error && (
        <div className="toast" onClick={() => setError("")}>
          {error}
        </div>
      )}
    </div>
  );
}

export default TestRunsPage;
