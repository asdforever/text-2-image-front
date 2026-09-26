import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type { AssetLibrary, Asset, CreateAssetInput } from "../types/asset";
import {
  getAssetLibrary,
  updateAssetLibrary,
  listAssets,
  createAsset,
  deleteAsset,
} from "../lib/api-asset";

export function AssetLibraryDetailPage() {
  const navigate = useNavigate();
  const { libraryId } = useParams({ from: "/asset-libraries/$libraryId" });
  const [library, setLibrary] = useState<AssetLibrary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [error, setError] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState("");

  useEffect(() => {
    void loadData();
  }, [libraryId]);

  async function loadData() {
    try {
      setLoading(true);
      const [lib, assetList] = await Promise.all([getAssetLibrary(libraryId), listAssets(libraryId)]);
      setLibrary(lib);
      setAssets(assetList);
      setEditName(lib.name);
      setEditDescription(lib.description || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!library || !editName.trim()) {
      setError("请输入名称");
      return;
    }
    try {
      await updateAssetLibrary(library.id, { name: editName.trim(), description: editDescription.trim() || undefined });
      setEditOpen(false);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  }

  async function handleUpload() {
    console.log("handleUpload called", { library, uploadName, uploadFile, uploadText });
    if (!library || !uploadName.trim()) {
      setError("请输入素材名称");
      return;
    }
    if (library.assetType === "image" && !uploadFile) {
      setError("请选择图片文件");
      return;
    }
    if (library.assetType === "text" && !uploadText.trim()) {
      setError("请输入文本内容");
      return;
    }
    try {
      const input: CreateAssetInput = {
        name: uploadName.trim(),
        file: library.assetType === "image" ? uploadFile! : undefined,
        content: library.assetType === "text" ? uploadText.trim() : undefined,
      };
      console.log("Creating asset with input:", input);
      await createAsset(library.id, input);
      setUploadOpen(false);
      setUploadName("");
      setUploadFile(null);
      setUploadText("");
      void loadData();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function handleDelete() {
    if (!library || !deleteTarget) return;
    try {
      await deleteAsset(library.id, deleteTarget.id);
      setDeleteTarget(null);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="page-loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="app-shell">
        <main className="management-page">
          <div className="empty-state">素材库不存在</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>{library.name}</strong>
          <span>{library.assetType === "image" ? "图片素材库" : "文本素材库"}</span>
        </div>
      </header>

      <main className="management-page">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate({ to: "/asset-libraries" })}
          style={{ marginBottom: 16 }}
        >
          <ArrowLeft size={14} />
          返回素材库列表
        </Button>

        <div className="management-toolbar">
          <div>
            <h1>{library.name}</h1>
            <p>{library.description || "暂无描述"}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              编辑信息
            </Button>
            <Button variant="secondary" onClick={() => setUploadOpen(true)}>
              <Plus size={14} />
              添加素材
            </Button>
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="empty-state">暂无素材，点击上方按钮添加</div>
        ) : (
          <div className="management-grid">
            {assets.map((asset) => (
              <article key={asset.id} className="management-card">
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                  <h2>{asset.name}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(asset)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                {asset.assetType === "image" && asset.url && (
                  <div className="project-thumb">
                    <img src={asset.url} alt={asset.name} />
                  </div>
                )}
                {asset.assetType === "text" && asset.content && (
                  <p style={{ fontSize: 11, color: "#89949d", marginTop: 8 }}>{asset.content.slice(0, 100)}...</p>
                )}
                <span>
                  {asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : "文本"} · 创建于{" "}
                  {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="编辑素材库">
        <div className="dialog-body">
          <div className="form-grid">
            <div className="form-field">
              <label>名称</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="form-field">
              <label>描述</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <Button variant="ghost" onClick={() => setEditOpen(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => void handleEdit()}>
            保存
          </Button>
        </div>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen} title="添加素材">
        <div className="dialog-body">
          <div className="form-grid">
            <div className="form-field">
              <label>素材名称</label>
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="测试图片001" />
            </div>
            {library.assetType === "image" ? (
              <div className="form-field">
                <label>图片文件</label>
                <Input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
            ) : (
              <div className="form-field">
                <label>文本内容</label>
                <Textarea
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder="输入文本内容"
                  rows={6}
                />
              </div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <Button variant="ghost" onClick={() => setUploadOpen(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => void handleUpload()}>
            <Upload size={14} />
            上传
          </Button>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(open) => !open && setDeleteTarget(null)} title="确认删除">
          <div className="dialog-body">
            <p style={{ color: "#e6e9eb" }}>确定删除素材「{deleteTarget.name}」？此操作无法恢复。</p>
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

export default AssetLibraryDetailPage;
