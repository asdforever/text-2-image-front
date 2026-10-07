import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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

export function ProductLibraryProjectPage() {
  const navigate = useNavigate();
  const { productId } = useParams({ from: "/product-libraries/projects/$productId" });
  const [product, setProduct] = useState<ApiProductionProduct | null>(null);
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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
  }, [productId]);

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
      ))
      : [],
    [batchFilter, filterIndex, moduleFilter, product],
  );

  if (loading) {
    return <div className="app-shell"><div className="page-loading"><div className="spinner" /></div></div>;
  }
  if (!product || error) {
    return (
      <div className="app-shell">
        <main className="management-page">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/product-libraries" })}>
            <ArrowLeft size={14} />返回成品库
          </Button>
          <div className="empty-state">{error || "项目成品不存在"}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="workspace-title">
          <strong>项目成品</strong>
          <span>按批次和模块类型查看项目图片</span>
        </div>
      </header>
      <main className="management-page">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/product-libraries" })}>
          <ArrowLeft size={14} />返回成品库
        </Button>
        <div className="management-toolbar product-archive-toolbar">
          <div>
            <h1>{product.name}</h1>
            <p>{filteredAssets.length} / {product.assets.length} 个资产</p>
          </div>
          {filterIndex && (
            <div className="product-library-inline-filters">
              <ImageBatchFilter batches={filterIndex.batches} value={batchFilter} onChange={setBatchFilter} label="项目批次" />
              <ImageModuleFilter modules={filterIndex.modules} value={moduleFilter} onChange={setModuleFilter} label="图片模块类型" />
            </div>
          )}
        </div>
        <ProjectArchive
          product={product}
          assets={filteredAssets}
          showOpenProject={false}
          emptyMessage="当前筛选没有图片"
        />
      </main>
    </div>
  );
}

export default ProductLibraryProjectPage;
