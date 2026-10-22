import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { ProjectArchive } from "../components/product-library/ProjectArchive";
import {
  suiteApi,
  type ApiProductionLibrary,
  type ApiProductionProduct,
} from "../api/client";

import "./reference-pages.css";
import "./reference-library-details.css";

export function ProductLibraryDetailPage() {
  const navigate = useNavigate();
  const { libraryId } = useParams({ from: "/product-libraries/$libraryId" });
  const [loadedLibrary, setLibrary] = useState<ApiProductionLibrary | null>(null);
  const [products, setProducts] = useState<ApiProductionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const library = loadedLibrary?.id === libraryId ? loadedLibrary : null;
  const visible = products.filter(product => product.name.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { setQuery(""); }, [libraryId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const load = async () => {
      try {
        const [nextLibrary, nextProducts] = await Promise.all([
          suiteApi.getProductionLibrary(libraryId),
          suiteApi.listProductionProducts(libraryId),
        ]);
        if (active) {
          setLibrary(nextLibrary);
          setProducts(nextProducts);
        }
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : "加载项目成品档案失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [libraryId, reload]);

  return (
    <div className="app-shell reference-library reference-detail reference-archive-detail">
      <header className="app-topbar"><div className="workspace-title"><strong>成品库</strong><span>{library?.name || "查看归档图片"}</span></div></header>
      <main className="management-page">
        <Button className="reference-detail-back" variant="ghost" size="sm" onClick={() => void navigate({ to: "/product-libraries" })}><ArrowLeft size={14} />返回成品库</Button>
        {error && <div className="upload-feedback" role="alert"><span>{error}</span><Button variant="secondary" size="sm" disabled={loading} onClick={() => setReload(value => value + 1)}>重试</Button></div>}
        {library && <>
          <div className="reference-library-heading reference-detail-heading"><div><h1>项目资产</h1><p>{library.description || "原图、白底图和生成结果，按项目自动归档"}</p></div></div>
          <div className="reference-library-filters">
            <label className="management-search"><Search size={15} /><input type="search" aria-label="搜索归档项目" placeholder="搜索项目名称" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <Button variant="secondary" disabled={loading} aria-label="刷新归档项目" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />刷新</Button>
            <span className="reference-library-result">{visible.length} / {products.length} 个项目</span>
          </div>
          {visible.length ? <div className="project-archive-list">{visible.map(product => <ProjectArchive product={product} key={product.id} />)}</div>
            : <div className="empty-state">{products.length ? "没有匹配的项目档案" : "暂无项目档案，创建项目后会自动出现"}</div>}
        </>}
        {!library && (loading ? <div className="page-loading" role="status" aria-label="正在加载成品档案"><div className="spinner" /></div> : !error && <div className="empty-state">成品档案不存在</div>)}
      </main>
    </div>
  );
}

export default ProductLibraryDetailPage;
