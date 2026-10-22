import { Search, Store, Plus, Trash2, Pencil } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { suiteApi, ApiResultUnknownError, createIdempotencyKey, type ApiPromptCategory, type ApiPromptTemplate, type ApiPromptTemplateDetail } from "../../api/client";
import { readCacheKeys, sharedReadCache } from "../../lib/read-cache";
import { filterPromptTemplates, type PromptCategoryFilter } from "../../lib/prompt-categories";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { PromptSidebar } from "./PromptSidebar";
import { PromptGrid } from "./PromptGrid";
import { PromptDetailPanel } from "./PromptDetailPanel";
import "./prompt-marketplace-interaction.css";
import "../../pages/reference-pages.css";
import "../../pages/reference-settings.css";

export function PromptMarketplacePageNew() {
  const cachedItems = sharedReadCache.peek<ApiPromptTemplate[]>(readCacheKeys.promptTemplates());
  const cachedCategories = sharedReadCache.peek<ApiPromptCategory[]>(readCacheKeys.promptCategories);
  const [items, setItems] = useState<ApiPromptTemplate[]>(() => cachedItems ?? []);
  const [categories, setCategories] = useState<ApiPromptCategory[]>(() => cachedCategories ?? []);
  const [activeCategory, setActiveCategory] = useState<PromptCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailActivation, setDetailActivation] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<ApiPromptTemplateDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detailError, setDetailError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [initialLoading, setInitialLoading] = useState(cachedItems === undefined);
  const [listError, setListError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [activeTabOverride, setActiveTabOverride] = useState<"info" | "versions" | "test" | "compare" | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(() => Object.fromEntries((cachedCategories ?? []).map((category) => [category.id, category.name])));
  const detailRequestId = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedId || !window.matchMedia("(max-width: 1100px)").matches) return;
    const frame = requestAnimationFrame(() => {
      const panel = shellRef.current?.querySelector<HTMLElement>(".prompt-detail-panel");
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, detailActivation]);

  const emptyPrompt = { code: "", name: "", kind: "image_to_image", kindName: "图生图", executionTarget: "llm", body: "", userPromptTemplate: "", categoryId: null as string | null };
  const [newPrompt, setNewPrompt] = useState(emptyPrompt);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());

  const isDirty = newPrompt.code !== "" || newPrompt.name !== "" || newPrompt.body !== "" || newPrompt.userPromptTemplate !== "" || Boolean(newPrompt.categoryId);

  const confirmClose = () => {
    if (creatingPrompt) return;
    if (!isDirty) { setCreating(false); return; }
    if (confirm("确定放弃已填写的内容？")) { setCreating(false); setNewPrompt(emptyPrompt); setCreateError(""); setIdempotencyKey(createIdempotencyKey()); }
  };

  const refresh = async () => {
    try {
      setItems(await suiteApi.listPromptTemplates());
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : "提示词列表加载失败");
    }
  };
  const refreshCategories = async () => {
    try {
      const next = await suiteApi.listPromptCategories();
      setCategories(next);
      setCategoryDrafts(Object.fromEntries(next.map((category) => [category.id, category.name])));
      setCategoryError("");
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "提示词分类加载失败");
    }
  };

  useEffect(() => {
    void Promise.all([refresh(), refreshCategories()]).finally(() => setInitialLoading(false));
  }, []);

  const filtered = useMemo(() => filterPromptTemplates(items, activeCategory, query), [items, activeCategory, query]);

  useEffect(() => {
    const visibleIds = new Set(filtered.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filtered]);

  const createCategory = async (name: string): Promise<ApiPromptCategory | null> => {
    if (!name.trim()) return null;
    try {
      const category = await suiteApi.createPromptCategory(name);
      setCategories((current) => [...current, category].sort((a, b) => a.sortOrder - b.sortOrder));
      setMessage("分类已创建");
      return category;
    } catch (error) {
      setMessage(error instanceof Error ? `分类创建失败：${error.message}` : "分类创建失败");
      return null;
    }
  };

  const saveCategoryName = async (category: ApiPromptCategory) => {
    const name = (categoryDrafts[category.id] ?? category.name).trim();
    if (!name || name === category.name) return;
    try {
      const updated = await suiteApi.updatePromptCategory(category.id, name);
      setCategories((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setMessage("分类已重命名");
    } catch (error) { setMessage(error instanceof Error ? `分类重命名失败：${error.message}` : "分类重命名失败"); }
  };

  const deleteCategory = async (category: ApiPromptCategory) => {
    if (!confirm(`删除“${category.name}”？${category.templateCount} 个提示词将转为未分类。`)) return;
    try {
      const result = await suiteApi.deletePromptCategory(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      if (activeCategory === category.id) setActiveCategory("all");
      setMessage(`分类已删除，${result.affectedTemplateCount} 个提示词转为未分类`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? `分类删除失败：${error.message}` : "分类删除失败"); }
  };

  const loadDetail = async (id: string) => {
    const requestId = ++detailRequestId.current;
    setDetailStatus("loading");
    setDetailError("");
    try {
      const detail = await suiteApi.getPromptTemplate(id);
      if (requestId !== detailRequestId.current || selectedIdRef.current !== id) return;
      setSelectedDetail(detail);
      setDetailStatus("ready");
    } catch (error) {
      if (requestId !== detailRequestId.current || selectedIdRef.current !== id) return;
      setDetailStatus("error");
      setDetailError(error instanceof Error ? error.message : "加载提示词详情失败");
    }
  };

  const handleSaveNewVersion = async (templateId: string, baseVersionId: string, data: { body: string; userPromptTemplate: string; changeNote: string; generationParams: Record<string, any> }) => {
    try {
      await suiteApi.createPromptVersion(templateId, {
        baseVersionId,
        body: data.body,
        userPromptTemplate: data.userPromptTemplate,
        changeNote: data.changeNote || undefined,
        generationParams: data.generationParams
      });
      setMessage("已保存为新版本");
      await Promise.all([refresh(), loadDetail(templateId)]);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleUpdateTemplate = async (templateId: string, data: { name?: string; kindName?: string; categoryId?: string | null }) => {
    try {
      await suiteApi.updatePromptTemplateInfo(templateId, data);
      setMessage("已更新模板信息");
      await Promise.all([refresh(), refreshCategories(), loadDetail(templateId)]);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleSetDefaultVersion = async (templateId: string, versionId: string) => {
    try {
      await suiteApi.setDefaultPromptVersion(templateId, versionId);
      setMessage("已设置默认版本");
      await Promise.all([refresh(), loadDetail(templateId)]);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "设置默认版本失败");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个提示词吗？此操作无法撤销。")) {
      return;
    }

    setDeleting(true);
    try {
      await suiteApi.deletePromptTemplate(id);
      setMessage("删除成功");

      // 如果删除的是当前选中的，关闭详情面板
      if (selectedId === id) {
        detailRequestId.current += 1;
        selectedIdRef.current = null;
        setSelectedId(null);
        setSelectedDetail(null);
        setDetailStatus("idle");
      }

      // 从选中列表中移除
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      setMessage("请先选择要删除的提示词");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个提示词吗？此操作无法撤销。`)) {
      return;
    }

    setDeleting(true);
    try {
      await suiteApi.deletePromptTemplates(Array.from(selectedIds));
      setMessage(`成功删除 ${selectedIds.size} 个提示词`);

      // 如果删除的包含当前选中的，关闭详情面板
      if (selectedId && selectedIds.has(selectedId)) {
        detailRequestId.current += 1;
        selectedIdRef.current = null;
        setSelectedId(null);
        setSelectedDetail(null);
        setDetailStatus("idle");
      }

      setSelectedIds(new Set());
      setBatchMode(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `批量删除失败：${error.message}` : "批量删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleBatchMode = () => {
    setBatchMode(!batchMode);
    if (batchMode) {
      // 退出批量模式时清空选中
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(item => item.id)));
    }
  };

  const handleSelect = (id: string) => {
    setDetailActivation(current => current + 1);
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedIdRef.current = id;
    setSelectedId(id);
    setSelectedDetail(sharedReadCache.peek<ApiPromptTemplateDetail>(readCacheKeys.promptDetail(id)) ?? null);
    void loadDetail(id);
  };

  const handleEdit = (item: ApiPromptTemplate) => {
    setDetailActivation(current => current + 1);
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedIdRef.current = item.id;
    setSelectedId(item.id);
    setSelectedDetail(sharedReadCache.peek<ApiPromptTemplateDetail>(readCacheKeys.promptDetail(item.id)) ?? null);
    setActiveTabOverride("info");
    void loadDetail(item.id);
  };

  const handleTest = (item: ApiPromptTemplate) => {
    setDetailActivation(current => current + 1);
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedIdRef.current = item.id;
    setSelectedId(item.id);
    setSelectedDetail(sharedReadCache.peek<ApiPromptTemplateDetail>(readCacheKeys.promptDetail(item.id)) ?? null);
    setActiveTabOverride("test");
    void loadDetail(item.id);
  };

  const handleDuplicate = async (item: ApiPromptTemplate) => {
    setDetailActivation(current => current + 1);
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 直接在版本历史中选择要复制的版本
    selectedIdRef.current = item.id;
    setSelectedId(item.id);
    setSelectedDetail(sharedReadCache.peek<ApiPromptTemplateDetail>(readCacheKeys.promptDetail(item.id)) ?? null);
    setActiveTabOverride("versions");
    void loadDetail(item.id);
  };

  const openCreate = () => { setCreateError(""); setCreating(true); setIdempotencyKey(createIdempotencyKey()); };

  const create = async () => {
    setCreateError("");
    if (!newPrompt.code.trim() || !newPrompt.name.trim() || !newPrompt.body.trim()) { setCreateError("请填写 code、名称和 System Prompt"); return; }
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(newPrompt.code.trim())) { setCreateError("code 只能包含字母、数字、点、下划线和短横线"); return; }
    setCreatingPrompt(true);
    try {
      const result = await suiteApi.createPromptTemplate({ ...newPrompt, code: newPrompt.code.trim(), name: newPrompt.name.trim(), body: newPrompt.body.trim() }, idempotencyKey);
      setMessage(`已创建 v${result.version.versionNo}`);
      setCreating(false);
      setNewPrompt(emptyPrompt);
      setIdempotencyKey(createIdempotencyKey());
      await Promise.all([refresh(), refreshCategories()]);
    } catch (error) {
      if (error instanceof ApiResultUnknownError) {
        setCreateError("创建结果未确认，请刷新列表核对");
        void refresh();
      } else {
        setCreateError(error instanceof Error ? `创建失败：${error.message}` : "创建失败，请检查后端服务和数据库连接");
      }
    } finally {
      setCreatingPrompt(false);
    }
  };

  return (
    <div className="app-shell reference-library reference-prompts">
      <header className="app-topbar">
        <div className="workspace-title">
          <Store size={16} />
          <div>
            <strong>提示词商城</strong>
            <span>管理、测试和对比提示词版本</span>
          </div>
        </div>
      </header>

      <main ref={shellRef} className={`prompt-marketplace-shell ${selectedId ? "has-detail" : ""}`}>
        <div className="reference-prompts-heading"><h1>提示词商城</h1><p>按业务整理模板，查看、测试和对比版本。</p><span>{items.length} 个模板 · {categories.length} 个分类</span></div>
        {initialLoading ? (
          <div className="prompt-loading-container">
            <div className="prompt-loading-spinner">
              <div className="spinner"></div>
              <p>加载中...</p>
            </div>
          </div>
        ) : (
          <>
            <PromptSidebar
              items={items}
              selectedId={selectedId}
              onSelect={handleSelect}
              searchQuery={query}
              categories={categories}
              activeCategory={activeCategory}
              onCategorySelect={(category) => { setActiveCategory(category); setSelectedIds(new Set()); }}
              onManageCategories={() => setManagingCategories(true)}
            />

            <div className="prompt-main-area">
              <div className="prompt-toolbar">
                <label className="prompt-search">
                  <Search size={15} />
                  <input
                    className="prompt-search-field"
                    aria-label="搜索提示词"
                    value={query}
                    placeholder="搜索提示词"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className="prompt-toolbar-actions">
                  {batchMode ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        {selectedIds.size === filtered.length ? "取消全选" : "全选"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBatchDelete}
                        disabled={deleting || selectedIds.size === 0}
                      >
                        <Trash2 size={15} />
                        删除选中 ({selectedIds.size})
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleToggleBatchMode}
                      >
                        取消
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleToggleBatchMode}
                      >
                        批量删除
                      </Button>
                      <Button className="prompt-create-button" size="sm" onClick={openCreate}>
                        <Plus size={15} />
                        新建提示词
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {message && <div className="upload-feedback" role="status">{message}</div>}
              {(listError || categoryError) && <div className="upload-feedback prompt-catalog-error" role="alert"><span>{[listError, categoryError].filter(Boolean).join("；")}</span><Button variant="ghost" size="sm" onClick={() => void Promise.all([refresh(), refreshCategories()])}>重试加载</Button></div>}

              <div className="prompt-grid-container">
                {filtered.length === 0 && !initialLoading ? (
                  <div className="empty-state">
                    <p>暂无提示词模板</p>
                    <Button onClick={openCreate}>新建提示词</Button>
                  </div>
                ) : (
                  <PromptGrid
                    items={filtered}
                    selectedIds={selectedIds}
                    batchMode={batchMode}
                    onEdit={handleEdit}
                    onTest={handleTest}
                    onDuplicate={handleDuplicate}
                    onSelect={(item) => handleSelect(item.id)}
                    onDelete={handleDelete}
                    onToggleSelect={handleToggleSelect}
                  />
                )}
              </div>
            </div>

            <PromptDetailPanel
              template={selectedDetail}
              selectedItem={items.find((item) => item.id === selectedId) ?? null}
              detailStatus={detailStatus}
              detailError={detailError}
              activeTabOverride={activeTabOverride}
              onClose={() => {
                detailRequestId.current += 1;
                selectedIdRef.current = null;
                setSelectedId(null);
                setSelectedDetail(null);
                setDetailStatus("idle");
                setDetailError("");
                setActiveTabOverride(null);
                requestAnimationFrame(() => detailTriggerRef.current?.focus());
              }}
              onRetry={() => { if (selectedId) void loadDetail(selectedId); }}
              onSaveNewVersion={handleSaveNewVersion}
              categories={categories}
              onCreateCategory={createCategory}
              onUpdateTemplate={handleUpdateTemplate}
              onSetDefaultVersion={handleSetDefaultVersion}
            />
          </>
        )}
      </main>

      {creating && (
        <Dialog open title="新建提示词" eyebrow="首次保存将创建 v1" onOpenChange={open => { if (!open) confirmClose(); }}>
            <div className="prompt-create-fields">
              <label className="prompt-form-field">
                <span>Code <em>必填</em></span>
                <input value={newPrompt.code} placeholder="例如 product.white-background" onChange={(event) => setNewPrompt({ ...newPrompt, code: event.target.value })} />
              </label>
              <label className="prompt-form-field">
                <span>名称 <em>必填</em></span>
                <input value={newPrompt.name} placeholder="例如：商品白底图生成" onChange={(event) => setNewPrompt({ ...newPrompt, name: event.target.value })} />
              </label>
              <div className="prompt-create-meta">
                <label className="prompt-form-field">
                  <span>业务分类</span>
                  <select value={newPrompt.categoryId ?? ""} onChange={(event) => { if (event.target.value !== "__create__") setNewPrompt({ ...newPrompt, categoryId: event.target.value || null }); else { const name = window.prompt("新建分类名称"); if (name) void createCategory(name).then((category) => { if (category) setNewPrompt({ ...newPrompt, categoryId: category.id }); }); } }}>
                    <option value="">未分类</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    <option value="__create__">+ 新建分类</option>
                  </select>
                </label>
              </div>
              <label className="prompt-form-field prompt-system-field">
                <span>System Prompt <em>必填</em></span>
                <textarea rows={8} value={newPrompt.body} placeholder="描述模型应遵循的系统行为和输出要求" onChange={(event) => setNewPrompt({ ...newPrompt, body: event.target.value })} />
              </label>
              <label className="prompt-form-field">
                <span>User Prompt Template <small>可选</small></span>
                <textarea rows={4} value={newPrompt.userPromptTemplate} placeholder="可选：定义传给模型的用户提示词模板" onChange={(event) => setNewPrompt({ ...newPrompt, userPromptTemplate: event.target.value })} />
              </label>
            </div>
            {createError && <div className="prompt-create-error" role="alert">{createError}</div>}
            <div className="prompt-create-actions">
              <Button variant="secondary" disabled={creatingPrompt} onClick={() => confirmClose()}>
                取消
              </Button>
              <Button disabled={creatingPrompt} onClick={() => void create()}>
                {creatingPrompt ? "创建中…" : "创建 v1"}
              </Button>
            </div>
        </Dialog>
      )}
      {managingCategories && (
        <Dialog open title="分类管理" eyebrow="按业务整理提示词" onOpenChange={setManagingCategories}>
            <div className="prompt-category-manager-body">
              <div className="prompt-category-create-row"><input aria-label="新分类名称" value={newCategoryName} maxLength={40} placeholder="输入新分类名称" onChange={(event) => setNewCategoryName(event.target.value)} /><Button size="sm" onClick={() => void createCategory(newCategoryName).then((category) => { if (category) setNewCategoryName(""); })}><Plus size={13} />新增分类</Button></div>
              {categories.length === 0 ? <div className="prompt-category-manager-empty">暂无自定义分类</div> : categories.map((category) => <div className="prompt-category-manager-row" key={category.id}><input aria-label={`编辑分类 ${category.name}`} value={categoryDrafts[category.id] ?? category.name} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.id]: event.target.value }))} /><span>{category.templateCount} 个提示词</span><Button size="sm" variant="ghost" title="保存重命名" onClick={() => void saveCategoryName(category)}><Pencil size={13} /></Button><Button size="sm" variant="ghost" title="删除分类" onClick={() => void deleteCategory(category)}><Trash2 size={13} /></Button></div>)}
            </div>
        </Dialog>
      )}
    </div>
  );
}
