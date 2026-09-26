import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderOpen, Package } from "lucide-react";
import { suiteApi, type ApiProductionLibrary } from "../api/client";

type ProjectLibrary = ApiProductionLibrary & { projectCount: number };

export function ProductLibrariesPage() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<ProjectLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const all = await suiteApi.listProductionLibraries();
        const systemLibraries = all.filter((item) => item.name === "项目成品库");
        const rows = await Promise.all(
          systemLibraries.map(async (library) => ({
            ...library,
            projectCount: (await suiteApi.listProductionProducts(library.id)).length,
          })),
        );
        if (active) setLibraries(rows);
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : "加载成品库失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>成品库</strong>
          <span>按项目汇总源图、白底图和全部生成结果</span>
        </div>
      </header>
      <main className="management-page">
        <div className="management-toolbar">
          <div>
            <h1>项目成品档案</h1>
            <p>项目创建后自动建档，后续资产会实时汇总到对应项目。</p>
          </div>
        </div>

        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : libraries.length === 0 ? (
          <div className="empty-state">还没有项目成品档案，创建项目后会自动出现</div>
        ) : (
          <div className="management-grid product-library-grid">
            {libraries.map((library) => (
              <button
                type="button"
                className="management-card product-library-card"
                key={library.id}
                onClick={() => void navigate({
                  to: "/product-libraries/$libraryId",
                  params: { libraryId: library.id },
                })}
              >
                <span className="product-library-icon"><Package size={18} /></span>
                <span className="product-library-copy">
                  <strong>{library.name}</strong>
                  <small>{library.description || "按项目自动归档的全部资产"}</small>
                </span>
                <span className="product-library-count">
                  <FolderOpen size={14} />
                  {library.projectCount} 个项目
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
      {error && <div className="toast" role="alert" onClick={() => setError("")}>{error}</div>}
    </div>
  );
}

export default ProductLibrariesPage;
