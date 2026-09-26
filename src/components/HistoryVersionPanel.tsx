import { useState } from "react";
import type { Asset } from "../api/contracts";
import { Button } from "./ui/button";

interface HistoryVersionPanelProps {
  asset?: Asset;
  onGenerate?: () => void;
}

export function HistoryVersionPanel({ asset, onGenerate }: HistoryVersionPanelProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  if (!asset) return <div className="history-empty">选择一个资产后，在这里查看版本时间线。</div>;
  const toggleCompare = (versionId: string) => setCompareIds((current) => current.includes(versionId) ? current.filter((id) => id !== versionId) : current.length < 2 ? [...current, versionId] : [current[1], versionId]);
  const compared = asset.versions.filter((item) => compareIds.includes(item.id));
  return <div className="history-panel">
    <div className="section-heading"><div><h2>{asset.name}</h2><span>{asset.versions.length} 个版本</span></div></div>
    {onGenerate && <Button size="sm" variant="secondary" onClick={onGenerate}>重新生成此卡</Button>}
    {asset.versions.map((item) => <div className="history-item" key={item.id}><strong>v{item.version} · {item.template}</strong><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span><img src={item.url} alt="" /><button className="ui-button ui-button-sm ui-button-secondary" onClick={() => toggleCompare(item.id)}>{compareIds.includes(item.id) ? "已加入对比" : "加入对比"}</button></div>)}
    {compared.length === 2 && <div className="review-card"><strong>版本对比</strong><div className="compare-grid">{compared.map((item) => <div key={item.id}><span>v{item.version}</span><img src={item.url} alt={`版本 ${item.version}`} /></div>)}</div></div>}
  </div>;
}
