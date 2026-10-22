import { ChevronDown, ChevronRight, Search, Images } from "lucide-react";
import { useMemo, useState } from "react";
import type { Asset, AssetType, OutputTarget, Project } from "../api/contracts";
import { Input } from "./ui/input";
import "./reference-panels.css";

const groups: { type: AssetType; label: string }[] = [
  { type: "source", label: "原图" },
  { type: "base", label: "白底图" },
  { type: "hero", label: "主图" },
  { type: "suite", label: "套图" },
  { type: "video", label: "视频" },
];

interface AssetLibraryPanelProps {
  project: Project;
  selectedAssetId: string | null;
  onLocate: (asset: Asset, tab: OutputTarget) => void;
}

export function AssetLibraryPanel({ project, selectedAssetId, onLocate }: AssetLibraryPanelProps) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<AssetType, boolean>>({ source: true, base: true, hero: true, suite: true, video: false });
  const filtered = useMemo(() => project.assets.filter(asset => asset.name.toLowerCase().includes(query.trim().toLowerCase())), [project.assets, query]);
  const toggle = (type: AssetType) => setOpenGroups(current => ({ ...current, [type]: !current[type] }));

  return <div className="asset-panel reference-asset-panel">
    <p className="panel-description">按类型查找素材，点击查看对应版本。</p>
    <div className="panel-search"><Search size={15} aria-hidden="true" /><Input aria-label="搜索项目素材" value={query} placeholder="搜索素材名称" onChange={event => setQuery(event.target.value)} /></div>
    {filtered.length === 0 && query.trim() ? <div className="panel-search-empty" role="status"><Images size={24} /><strong>没有找到匹配的素材</strong><span>试试其他名称，或清空搜索。</span></div> : groups.map(group => {
      const assets = filtered.filter(asset => asset.type === group.type);
      return <section className="asset-group" key={group.type}>
        <button type="button" className="asset-group-toggle" aria-expanded={openGroups[group.type]} onClick={() => toggle(group.type)}>
          <span>{openGroups[group.type] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{group.label}</span><span>{assets.length}</span>
        </button>
        {openGroups[group.type] && <div className="asset-list">
          {assets.length === 0 ? <div className="panel-empty">暂无{group.label}</div> : assets.map(asset => <button type="button" className={`asset-item ${asset.id === selectedAssetId ? "selected" : ""}`} aria-pressed={asset.id === selectedAssetId} key={asset.id} onClick={() => onLocate(asset, asset.type === "suite" ? "suite" : asset.type === "video" ? "video" : asset.type === "hero" ? "hero" : "base")}>
            <img src={asset.url} alt="" loading="lazy" /><span><strong title={asset.name}>{asset.name}</strong><span>{asset.dimensions} · v{asset.version}</span></span>
          </button>)}
        </div>}
      </section>;
    })}
    <div className="panel-stats">{query.trim() ? `找到 ${filtered.length} 个素材 / 共 ${project.assets.length} 个` : `共 ${project.assets.length} 个素材`}</div>
  </div>;
}
