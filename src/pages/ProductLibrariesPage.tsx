import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Image, Images, FolderOpen, RefreshCw, Search } from "lucide-react";
import { suiteApi, type ApiProductionLibrary, type ApiProductionProduct } from "../api/client";
import { ImageBatchFilter, ImageModuleFilter } from "../components/image-canvas/ImageBatchFilter";
import { ProjectArchive } from "../components/product-library/ProjectArchive";
import { ALL_BATCHES, ALL_MODULES, buildProductionImageFilterIndex, matchesProductionImageFilters } from "../components/product-library/product-image-filters";

import { Button } from "../components/ui/button";
import "./reference-pages.css";

export function ProductLibrariesPage() {
  const navigate = useNavigate();
  const [library, setLibrary] = useState<ApiProductionLibrary | null>(null);
  const [projects, setProjects] = useState<ApiProductionProduct[]>([]);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
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
  }, [reload]);

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

  const visible = projects.filter(product => product.name.toLowerCase().includes(query.trim().toLowerCase())
    && (stateFilter === "all" || (stateFilter === "empty" ? !product.assets.length : product.assets.some(asset => asset.kind === "generated"))));
  const generatedCount = projects.reduce((total, product) => total + product.assets.filter(asset => asset.kind === "generated").length, 0);
  const assetCount = projects.reduce((total, product) => total + product.assets.length, 0);

  return (
    <div className="app-shell reference-library reference-products">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>成品库</strong>
          <span>按项目汇总源图、白底图和全部生成结果</span>
        </div>
      </header>
      <main className="management-page">
        <div className="reference-library-heading"><div><h1>项目成品档案</h1><p>生成结果自动归档，按项目查看与取用</p></div></div>
        <div className="reference-project-stats" aria-label="成品档案概况">
          <div><small><FolderOpen size={13} />项目档案</small><strong>{projects.length}</strong></div>
          <div className="is-complete"><small><Images size={13} />生成图片</small><strong>{generatedCount}</strong></div>
          <div><small><Image size={13} />全部图片</small><strong>{assetCount}</strong></div>
          <div><small><FolderOpen size={13} />暂无图片</small><strong>{projects.filter(product => !product.assets.length).length}</strong></div>
        </div>
        <div className="reference-library-filters">
          <label className="management-search"><Search size={15} /><input type="search" aria-label="搜索成品档案" placeholder="搜索项目名称" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select className="reference-library-select" aria-label="成品状态筛选" value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">全部档案</option><option value="generated">已有生成图</option><option value="empty">暂无图片</option></select>
          <Button variant="secondary" disabled={loading} aria-label="刷新成品档案" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} className={loading ? "spin" : ""} />刷新</Button>
          <span className="reference-library-result">{visible.length} 个项目</span>
        </div>
        {error && <div className="upload-feedback" role="alert"><span>{error}</span><Button variant="secondary" size="sm" disabled={loading} onClick={() => setReload(value => value + 1)}>重试</Button></div>}

        {loading && !projects.length ? (
          <div className="page-loading" role="status" aria-label="正在加载成品档案"><div className="spinner" /></div>
        ) : !library || visible.length === 0 ? (
          <div className="empty-state">{error ? "档案加载失败，请重试" : projects.length ? "没有匹配的成品档案，试试其他关键词或状态" : "还没有项目成品档案，创建项目后会自动出现"}</div>
        ) : (
          <div className="workflow-project-grid product-library-project-grid">
            {visible.map((product) => {
              const cover = product.assets.find(asset => asset.kind === "generated")
                ?? product.assets.find(asset => asset.kind === "white_background") ?? product.assets[0];
              return (
                <Fragment key={product.id}>
                <button
                  className="workflow-project-card"
                  type="button"
                  aria-expanded={product.projectId ? undefined : expandedProductId === product.id}
                  aria-controls={product.projectId ? undefined : `product-archive-${product.id}`}
                  onClick={() => {
                    if (product.projectId) {
                      void navigate({
                        to: "/product-libraries/projects/$productId",
                        params: { productId: product.id },
                      });
                      return;
                    }
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
                    <span className={`reference-status ${product.assets.some(asset => asset.kind === "generated") ? "active" : ""}`}>{product.assets.some(asset => asset.kind === "generated") ? "已有生成图" : product.assets.length ? "待生成" : "暂无图片"}</span>
                    <p>{product.assets.length} 张图片</p>
                    <small>{product.projectId ? "查看项目成品" : "展开图片档案"}</small>
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
    </div>
  );
}

export default ProductLibrariesPage;
