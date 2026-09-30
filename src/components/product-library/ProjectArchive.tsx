import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import type { ApiProductionAsset, ApiProductionProduct } from "../../api/client";

const assetGroups = [
  ["source", "原图"],
  ["white_background", "白底图"],
  ["hero", "主图"],
  ["detail", "详情图"],
  ["scene", "场景图"],
  ["edit", "编辑结果"],
  ["long_image", "长图"],
  ["generated", "其他生成图"],
] as const;

type AssetGroupKey = (typeof assetGroups)[number][0];

function groupKey(asset: ApiProductionAsset): AssetGroupKey {
  if (asset.kind === "source" || asset.kind === "white_background") return asset.kind;
  if (asset.sourceKind === "long_image") return "long_image";
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

export function ProjectArchive({ product, assets = product.assets, showOpenProject = true, emptyMessage = "项目已建档，暂无图片资产" }: { product: ApiProductionProduct; assets?: ApiProductionAsset[]; showOpenProject?: boolean; emptyMessage?: string }) {
  const navigate = useNavigate();
  const grouped = useMemo(() => {
    const result = new Map<AssetGroupKey, ApiProductionAsset[]>();
    for (const asset of assets) {
      const key = groupKey(asset);
      result.set(key, [...(result.get(key) ?? []), asset]);
    }
    return result;
  }, [assets]);

  return (
    <article className="project-archive">
      <div className="project-archive-header">
        <div>
          <h2>{product.name}</h2>
          <span>{assets.length} 个资产</span>
        </div>
        {showOpenProject && product.projectId && (
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

      {assets.length === 0 ? (
        <div className="project-archive-empty">
          <ImageIcon size={20} />
          <span>{emptyMessage}</span>
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
