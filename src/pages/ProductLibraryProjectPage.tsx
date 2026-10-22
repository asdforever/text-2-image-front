import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { ImageBatchFilter, ImageModuleFilter } from "../components/image-canvas/ImageBatchFilter";
import { ProjectArchive } from "../components/product-library/ProjectArchive";
import { Button } from "../components/ui/button";
import { suiteApi, type ApiProductionProduct } from "../api/client";
import {
  ALL_BATCHES,
  ALL_MODULES,
  buildProductionImageFilterIndex,
  matchesProductionImageFilters,
} from "../components/product-library/product-image-filters";

import "./reference-pages.css";
import "./reference-library-details.css";

export function ProductLibraryProjectPage() {
  const navigate = useNavigate();
  const { productId } = useParams({ from: "/product-libraries/projects/$productId" });
  const [loadedProduct, setProduct] = useState<ApiProductionProduct | null>(null);
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const product = loadedProduct?.id === productId ? loadedProduct : null;

  useEffect(() => { setBatchFilter(ALL_BATCHES); setModuleFilter(ALL_MODULES); setQuery(""); }, [productId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void suiteApi.getProductionProduct(productId)
      .then((nextProduct) => {
        if (active) setProduct(nextProduct);
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : "加载项目成品失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [productId, reload]);

  const filterIndex = useMemo(
    () => product ? buildProductionImageFilterIndex(product) : null,
    [product],
  );
  const filteredAssets = useMemo(
    () => product && filterIndex
      ? product.assets.filter((asset) => matchesProductionImageFilters(
        filterIndex,
        batchFilter,
        moduleFilter,
        asset.id,
        ...asset.versions.map((version) => version.id),
      ) && asset.originalFilename.toLowerCase().includes(query.trim().toLowerCase()))
      : [],
    [batchFilter, filterIndex, moduleFilter, product, query],
  );

  return (
    <div className="app-shell reference-library reference-detail reference-archive-detail">
      <header className="app-topbar"><div className="workspace-title"><strong>项目成品</strong><span>按批次与模块查看生成结果</span></div></header>
      <main className="management-page">
        <Button className="reference-detail-back" variant="ghost" size="sm" onClick={() => void navigate({ to: "/product-libraries" })}><ArrowLeft size={14} />返回成品库</Button>
        {error && <div className="upload-feedback" role="alert"><span>{error}</span><Button variant="secondary" size="sm" disabled={loading} onClick={() => setReload(value => value + 1)}>重试</Button></div>}
        {product && <>
          <div className="reference-library-heading reference-detail-heading"><div><h1>{product.name}</h1><p>{product.assets.length} 张图片，按用途分组归档</p></div></div>
          <div className="reference-library-filters reference-archive-filters">
            <label className="management-search"><Search size={15} /><input type="search" aria-label="搜索成品图片" placeholder="搜索图片文件名" value={query} onChange={event => setQuery(event.target.value)} /></label>
            {filterIndex && <div className="product-library-inline-filters">
              <ImageBatchFilter batches={filterIndex.batches} value={batchFilter} onChange={setBatchFilter} label="项目批次" />
              <ImageModuleFilter modules={filterIndex.modules} value={moduleFilter} onChange={setModuleFilter} label="图片模块类型" />
            </div>}
            <Button variant="secondary" disabled={loading} aria-label="刷新成品图片" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />刷新</Button>
            {(query || batchFilter !== ALL_BATCHES || moduleFilter !== ALL_MODULES) && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setBatchFilter(ALL_BATCHES); setModuleFilter(ALL_MODULES); }}>重置筛选</Button>}
            <span className="reference-library-result">{filteredAssets.length} / {product.assets.length} 张图片</span>
          </div>
          <ProjectArchive product={product} assets={filteredAssets} showOpenProject={false} emptyMessage="当前筛选没有图片" />
        </>}
        {!product && (loading ? <div className="page-loading" role="status" aria-label="正在加载项目成品"><div className="spinner" /></div> : !error && <div className="empty-state">项目成品不存在</div>)}
      </main>
    </div>
  );
}

export default ProductLibraryProjectPage;
