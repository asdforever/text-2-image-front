import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import type { AssetLibrary, CreateAssetLibraryInput } from "../types/asset";
import {
  listAssetLibraries,
  createAssetLibrary,
  deleteAssetLibrary,
} from "../lib/api-asset";

export function AssetLibrariesPage() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<AssetLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetLibrary | null>(null);
  const [error, setError] = useState("");

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssetType, setFormAssetType] = useState<"image" | "text">("image");

  useEffect(() => {
    void loadLibraries();
  }, []);

  async function loadLibraries() {
    try {
      setLoading(true);
      const data = await listAssetLibraries();
      setLibraries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }

  async function handleCreate() {
    if (!formName.trim()) {
      setError("请输入名称");
      return;
    }
    try {
      const input: CreateAssetLibraryInput = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        assetType: formAssetType,
      };
      await createAssetLibrary(input);
      setCreateOpen(false);
      setFormName("");
      setFormDescription("");
      setFormAssetType("image");
      void loadLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAssetLibrary(deleteTarget.id);
      setDeleteTarget(null);
      void loadLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  if (initialLoading) {
    return (
      <div className="app-shell">
        <div className="page-loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>素材库</strong>
          <span>管理可复用的共享输入素材（图片、文本）</span>
        </div>
      </header>

      <main className="management-page">
        <div className="management-toolbar">
          <div>
            <h1>素材库</h1>
            <p>组织可复用的商品原图、参考图和文本素材</p>
          </div>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            新建素材库
          </Button>
        </div>

        {loading ? (
          <div className="page-loading">
            <div className="spinner"></div>
          </div>
        ) : libraries.length === 0 ? (
          <div className="empty-state">暂无素材库，点击上方按钮创建第一个</div>
        ) : (
          <div className="management-grid">
            {libraries.map((library) => (
              <article key={library.id} className="management-card">
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {library.assetType === "image" ? (
                      <ImageIcon size={16} style={{ color: "#89949d" }} />
                    ) : (
                      <FileText size={16} style={{ color: "#89949d" }} />
                    )}
                    <h2
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        void navigate({ to: "/asset-libraries/$libraryId", params: { libraryId: library.id } })
                      }
                    >
                      {library.name}
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(library);
                    }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
                {library.description && <p>{library.description}</p>}
                <span>
                  {library.assetType === "image" ? "图片素材" : "文本素材"} · 创建于{" "}
                  {new Date(library.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="新建素材库">
        <div className="dialog-body">
          <div className="form-grid">
            <div className="form-field">
              <label>名称</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="测试图片集" />
            </div>
            <div className="form-field">
              <label>描述（可选）</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="用于功能测试的产品图片"
              />
            </div>
            <div className="form-field">
              <label>素材类型</label>
              <Select value={formAssetType} onChange={(e) => setFormAssetType(e.target.value as "image" | "text")}>
                <option value="image">图片</option>
                <option value="text">文本</option>
              </Select>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => void handleCreate()}>
            创建
          </Button>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(open) => !open && setDeleteTarget(null)} title="确认删除">
          <div className="dialog-body">
            <p style={{ color: "#e6e9eb" }}>
              确定删除素材库「{deleteTarget.name}」？此操作会同时删除库内所有素材，无法恢复。
            </p>
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

export default AssetLibrariesPage;
