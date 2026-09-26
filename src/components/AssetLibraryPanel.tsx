import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Asset, AssetType, OutputTarget, Project } from "../api/contracts";
import { Input } from "./ui/input";

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
  const filtered = useMemo(() => project.assets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase())), [project.assets, query]);
  const toggle = (type: AssetType) => setOpenGroups((current) => ({ ...current, [type]: !current[type] }));

  return <div className="asset-panel"><div className="panel-search"><Search size={14} /><Input value={query} placeholder="搜索资产" onChange={(event) => setQuery(event.target.value)} /></div>{groups.map((group) => { const assets = filtered.filter((asset) => asset.type === group.type); return <section className="asset-group" key={group.type}><button className="asset-group-toggle" onClick={() => toggle(group.type)}><span>{openGroups[group.type] ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {group.label}</span><span>{assets.length}</span></button>{openGroups[group.type] && <div className="asset-list">{assets.length === 0 ? <div className="panel-empty">暂无{group.label}资产</div> : assets.map((asset) => <button className={`asset-item ${asset.id === selectedAssetId ? "selected" : ""}`} key={asset.id} onClick={() => onLocate(asset, asset.type === "suite" ? "suite" : asset.type === "video" ? "video" : asset.type === "hero" ? "hero" : "base")}><img src={asset.url} alt="" /><span><strong>{asset.name}</strong><span>{asset.dimensions} · v{asset.version}</span></span></button>)}</div>}</section>; })}<div className="panel-stats">共 {project.assets.length} 个资产 · 占用 48.5 MB</div></div>;
}
