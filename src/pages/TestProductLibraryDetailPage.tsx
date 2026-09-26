import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Image, Search, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { createProduct, deleteProduct, getProductLibrary, listProducts } from "../lib/api-asset";
import type { Product, ProductLibrary } from "../types/asset";

function promptSource(product: Product) {
  const promptTemplateName = product.metadata?.promptTemplateName;
  const promptVersionNo = product.metadata?.promptVersionNo;
  if (typeof promptTemplateName !== "string" || !promptTemplateName.trim()) {
    return null;
  }
  return {
    name: promptTemplateName,
    version: typeof promptVersionNo === "number" ? `v${promptVersionNo}` : "版本未知",
  };
}

export function TestProductLibraryDetailPage() {
  const navigate = useNavigate();
  const { libraryId } = useParams({ from: "/test-product-libraries/$libraryId" });
  const [library, setLibrary] = useState<ProductLibrary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Product["productType"]>("image");
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [nextLibrary, nextProducts] = await Promise.all([
        getProductLibrary(libraryId),
        listProducts(libraryId),
      ]);
      setLibrary(nextLibrary);
      setProducts(nextProducts);
    } catch (value) {
      setError(value instanceof Error ? value.message : "加载测试库失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [libraryId]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return products;
    return products.filter((product) => {
      const source = promptSource(product);
      return [product.name, source?.name, source?.version]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("zh-CN").includes(normalizedQuery));
    });
  }, [products, query]);

  const upload = async () => {
    if (!name.trim() || !file) {
      setError("请输入名称并选择文件");
      return;
    }
    try {
      await createProduct(libraryId, { name: name.trim(), productType: type, file });
      setUploadOpen(false);
      setName("");
      setFile(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "上传测试成品失败");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(libraryId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "删除测试成品失败");
    }
  };

  if (loading) {
    return <div className="app-shell"><div className="page-loading"><div className="spinner" /></div></div>;
  }
  if (!library) {
    return <div className="app-shell"><main className="management-page"><div className="empty-state">测试库不存在</div></main></div>;
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <Button variant="ghost" size="icon" title="返回测试库" onClick={() => void navigate({ to: "/test-product-libraries" })}>
            <ArrowLeft size={15} />
          </Button>
          <div><strong>{library.name}</strong><span>测试来源 · 不可直接发布为正式成品</span></div>
        </div>
      </header>
      <main className="management-page">
        <div className="management-toolbar">
          <div><h1>{library.name}</h1><p>{library.description || "测试运行结果和手动上传结果"}</p></div>
          <div className="test-library-actions">
            <label className="test-library-search">
              <Search size={14} />
              <Input
                aria-label="筛选提示词或版本"
                placeholder="筛选提示词或版本"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <Button variant="secondary" onClick={() => setUploadOpen(true)}><Upload size={14} />上传测试成品</Button>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="empty-state">暂无测试成品</div>
        ) : visibleProducts.length === 0 ? (
          <div className="empty-state">没有匹配的测试成品</div>
        ) : (
          <div className="management-grid">
            {visibleProducts.map((product) => {
              const source = promptSource(product);
              return (
                <article className="management-card" key={product.id}>
                  <div className="test-product-heading">
                    <div><Image size={15} /><h2>{product.name}</h2></div>
                    <Button variant="ghost" size="icon" title="删除测试成品" onClick={() => setDeleteTarget(product)}><Trash2 size={13} /></Button>
                  </div>
                  {product.url ? <div className="project-thumb"><img src={product.url} alt={product.name} /></div> : <p>暂无预览</p>}
                  <div className="test-product-source">
                    {source ? <><strong>{source.name}</strong><span>{source.version}</span></> : <span>未记录提示词来源</span>}
                  </div>
                  <span>{product.productType} · 测试结果 · {(product.fileSize / 1024).toFixed(1)} KB</span>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen} title="上传测试成品">
        <div className="dialog-body">
          <div className="form-grid">
            <div className="form-field"><label>名称</label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="白底图测试结果" /></div>
            <div className="form-field"><label>成品类型</label><Select value={type} onChange={(event) => setType(event.target.value as Product["productType"])}><option value="image">图片</option><option value="white_background">白底图</option><option value="hero">主图</option><option value="detail">详情页</option><option value="scene">场景图</option><option value="video">视频</option><option value="document">文档</option></Select></div>
            <div className="form-field"><label>文件</label><Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
          </div>
        </div>
        <div className="dialog-footer"><Button variant="ghost" onClick={() => setUploadOpen(false)}>取消</Button><Button variant="secondary" onClick={() => void upload()}>上传</Button></div>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="删除测试成品">
        <div className="dialog-body"><p>确认删除“{deleteTarget?.name}”？</p></div>
        <div className="dialog-footer"><Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="danger" onClick={() => void remove()}>删除</Button></div>
      </Dialog>
      {error && <div className="toast" role="alert" onClick={() => setError("")}>{error}</div>}
    </div>
  );
}

export default TestProductLibraryDetailPage;
