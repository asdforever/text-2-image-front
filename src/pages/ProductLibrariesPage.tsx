import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, Image } from "lucide-react";
import { suiteApi, type ApiProductionLibrary, type ApiProductionProduct } from "../api/client";
import { ImageBatchFilter, ImageModuleFilter } from "../components/image-canvas/ImageBatchFilter";
import { ProjectArchive } from "../components/product-library/ProjectArchive";
import { ALL_BATCHES, ALL_MODULES, buildProductionImageFilterIndex, matchesProductionImageFilters } from "../components/product-library/product-image-filters";

export function ProductLibrariesPage() {
  const [library, setLibrary] = useState<ApiProductionLibrary | null>(null);
  const [projects, setProjects] = useState<ApiProductionProduct[]>([]);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const all = await suiteApi.listProductionLibraries();
        const projectLibrary = all.find((item) => item.name === "项目成品库") ?? null;
        const products = projectLibrary ? await suiteApi.listProductionProducts(projectLibrary.id) : [];
        if (active) {
          setLibrary(projectLibrary);
          setProjects(products);
        }
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : "加载成品库失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const selectedProduct = useMemo(
    () => projects.find(product => product.id === expandedProductId) ?? null,
    [expandedProductId, projects],
  );
  const selectedIndex = useMemo(
    () => selectedProduct ? buildProductionImageFilterIndex(selectedProduct) : null,
    [selectedProduct],
  );
  const selectedAssets = useMemo(
    () => selectedProduct && selectedIndex
      ? selectedProduct.assets.filter(asset => matchesProductionImageFilters(
        selectedIndex,
        batchFilter,
        moduleFilter,
        asset.id,
        ...asset.versions.map(version => version.id),
      ))
      : [],
    [batchFilter, moduleFilter, selectedIndex, selectedProduct],
  );

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
        ) : !library || projects.length === 0 ? (
          <div className="empty-state">还没有项目成品档案，创建项目后会自动出现</div>
        ) : (
          <div className="workflow-project-grid product-library-project-grid">
            {projects.map((product) => {
              const cover = product.assets.find((asset) => asset.kind === "source") ?? product.assets[0];
              return (
                <Fragment key={product.id}>
                <button
                  className="workflow-project-card"
                  type="button"
                  aria-expanded={expandedProductId === product.id}
                  aria-controls={`product-archive-${product.id}`}
                  onClick={() => {
                    setExpandedProductId(current => current === product.id ? null : product.id);
                    setBatchFilter(ALL_BATCHES);
                    setModuleFilter(ALL_MODULES);
                  }}
                >
                  <div className="project-thumb">
                    {cover ? <img src={cover.previewUrl} alt="" loading="lazy" /> : <Image size={28} strokeWidth={1} />}
                  </div>
                  <div className="workflow-project-body">
                    <h3>{product.name}</h3>
                    <p>{product.assets.length} 张图片</p>
                    <span>继续处理</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
                {selectedProduct?.id === product.id && selectedIndex && (
                  <section className="product-library-inline-archive" id={`product-archive-${product.id}`}>
                    <div className="product-library-inline-toolbar">
                      <div>
                        <strong>项目图片</strong>
                        <span>{selectedAssets.length} / {selectedProduct.assets.length} 张</span>
                      </div>
                      <div className="product-library-inline-filters">
                        <ImageBatchFilter batches={selectedIndex.batches} value={batchFilter} onChange={setBatchFilter} label="项目批次" />
                        <ImageModuleFilter modules={selectedIndex.modules} value={moduleFilter} onChange={setModuleFilter} label="图片模块类型" />
                      </div>
                    </div>
                    <ProjectArchive product={selectedProduct} assets={selectedAssets} showOpenProject={false} emptyMessage="当前筛选没有图片" />
                  </section>
                )}
                </Fragment>
              );
            })}
          </div>
        )}
      </main>
      {error && <div className="toast" role="alert" onClick={() => setError("")}>{error}</div>}
    </div>
  );
}

export default ProductLibrariesPage;
