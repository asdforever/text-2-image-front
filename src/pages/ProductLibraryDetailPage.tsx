import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  suiteApi,
  type ApiProductionAsset,
  type ApiProductionLibrary,
  type ApiProductionProduct,
} from "../api/client";

const assetGroups = [
  ["source", "原图"],
  ["white_background", "白底图"],
  ["hero", "主图"],
  ["detail", "详情图"],
  ["scene", "场景图"],
  ["edit", "编辑结果"],
  ["generated", "其他生成图"],
] as const;

type AssetGroupKey = (typeof assetGroups)[number][0];

function groupKey(asset: ApiProductionAsset): AssetGroupKey {
  if (asset.kind === "source" || asset.kind === "white_background") return asset.kind;
  const versionType = asset.versions[0]?.productType;
  if (versionType === "hero" || versionType === "detail" || versionType === "scene" || versionType === "edit") {
    return versionType;
  }
  const snapshotType = asset.sourceSnapshot.assetType;
  if (snapshotType === "hero" || snapshotType === "detail" || snapshotType === "scene" || snapshotType === "edit") {
    return snapshotType;
  }
  return "generated";
}

function ProjectArchive({ product }: { product: ApiProductionProduct }) {
  const navigate = useNavigate();
  const grouped = useMemo(() => {
    const result = new Map<AssetGroupKey, ApiProductionAsset[]>();
    for (const asset of product.assets) {
      const key = groupKey(asset);
      result.set(key, [...(result.get(key) ?? []), asset]);
    }
    return result;
  }, [product.assets]);

  return (
    <article className="project-archive">
      <div className="project-archive-header">
        <div>
          <h2>{product.name}</h2>
          <span>{product.assets.length} 个资产</span>
        </div>
        {product.projectId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigate({
              to: "/projects/$projectId",
              params: { projectId: product.projectId! },
              search: { tab: "base" },
            })}
          >
            <ExternalLink size={13} />打开项目
          </Button>
        )}
      </div>

      {product.assets.length === 0 ? (
        <div className="project-archive-empty">
          <ImageIcon size={20} />
          <span>项目已建档，暂无图片资产</span>
        </div>
      ) : (
        <div className="project-archive-groups">
          {assetGroups.map(([key, label]) => {
            const assets = grouped.get(key) ?? [];
            if (assets.length === 0) return null;
            return (
              <section className="project-asset-group" key={key}>
                <h3>{label} {assets.length}</h3>
                <div className="project-asset-grid">
                  {assets.map((asset) => (
                    <a
                      className="project-asset-tile"
                      href={asset.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      key={asset.id}
                    >
                      <span className="project-asset-preview">
                        <img src={asset.previewUrl} alt={asset.originalFilename} />
                      </span>
                      <span className="project-asset-meta">
                        <strong>{asset.originalFilename}</strong>
                        <small>{asset.width} × {asset.height}</small>
                        <small>{asset.versions.length > 0 ? `${asset.versions.length} 个生成版本` : asset.sourceKind === "upload" ? "手动上传" : asset.sourceKind}</small>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

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
