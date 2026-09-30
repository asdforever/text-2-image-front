import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { ProjectArchive } from "../components/product-library/ProjectArchive";
import {
  suiteApi,
  type ApiProductionLibrary,
  type ApiProductionProduct,
} from "../api/client";

export function ProductLibraryDetailPage() {
  const navigate = useNavigate();
  const { libraryId } = useParams({ from: "/product-libraries/$libraryId" });
  const [library, setLibrary] = useState<ApiProductionLibrary | null>(null);
  const [products, setProducts] = useState<ApiProductionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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
  }, [libraryId]);

  if (loading) return <div className="app-shell"><div className="page-loading"><div className="spinner" /></div></div>;
  if (!library) return <div className="app-shell"><main className="management-page"><div className="empty-state">成品档案不存在</div></main></div>;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>{library.name}</strong>
          <span>{products.length} 个项目 · 自动汇总全部项目图片</span>
        </div>
      </header>
      <main className="management-page">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/product-libraries" })}>
          <ArrowLeft size={14} />返回成品库
        </Button>
        <div className="management-toolbar product-archive-toolbar">
          <div>
            <h1>项目资产</h1>
            <p>{library.description || "项目中的源图、白底图和生成结果会实时出现在这里。"}</p>
          </div>
        </div>
        {products.length === 0 ? (
          <div className="empty-state">暂无项目档案，创建项目后会自动出现</div>
        ) : (
          <div className="project-archive-list">
            {products.map((product) => <ProjectArchive product={product} key={product.id} />)}
          </div>
        )}
      </main>
      {error && <div className="toast" role="alert" onClick={() => setError("")}>{error}</div>}
    </div>
  );
}

export default ProductLibraryDetailPage;
