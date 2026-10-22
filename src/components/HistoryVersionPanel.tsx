import { useState } from "react";
import { History, Expand } from "lucide-react";
import type { Asset, AssetVersion } from "../api/contracts";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import "./reference-panels.css";

interface HistoryVersionPanelProps {
  asset?: Asset;
  onGenerate?: () => void;
}

export function HistoryVersionPanel({ asset, onGenerate }: HistoryVersionPanelProps) {
  if (!asset) return <div className="history-empty reference-history-empty"><History size={26} /><strong>还没有选择素材</strong><span>在项目素材中选择一张图片，查看它的版本记录。</span></div>;
  return <AssetHistory key={asset.id} asset={asset} onGenerate={onGenerate} />;
}

function AssetHistory({ asset, onGenerate }: HistoryVersionPanelProps & { asset: Asset }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<AssetVersion | null>(null);
  const toggleCompare = (versionId: string) => setCompareIds(current => current.includes(versionId) ? current.filter(id => id !== versionId) : current.length < 2 ? [...current, versionId] : [current[1], versionId]);
  const compared = asset.versions.filter(item => compareIds.includes(item.id));
  return <div className="history-panel reference-history-panel">
    <div className="section-heading"><div><h2 title={asset.name}>{asset.name}</h2><span>{asset.versions.length} 个版本</span></div></div>
    {onGenerate && <Button size="sm" variant="secondary" onClick={onGenerate}>重新生成此卡</Button>}
    {asset.versions.length === 0 && <p className="panel-description">暂无版本记录。</p>}
    <div className="history-version-list">{asset.versions.map(item => <article className="history-item" key={item.id}>
      <div className="history-version-heading"><strong>v{item.version}</strong><span>{item.template}</span></div>
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
      <button type="button" className="history-preview" aria-label={`预览版本 ${item.version}`} onClick={() => setPreview(item)}><img src={item.url} alt="" loading="lazy" /><span><Expand size={14} />查看大图</span></button>
      <Button variant="secondary" size="sm" aria-label={`对比版本 ${item.version}`} aria-pressed={compareIds.includes(item.id)} onClick={() => toggleCompare(item.id)}>{compareIds.includes(item.id) ? "已选择对比" : "加入对比"}</Button>
    </article>)}</div>
    {compared.length > 0 && <section className="history-comparison" aria-label="版本对比">
      <header><strong>版本对比 · {compared.length}/2</strong><Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>清空</Button></header>
      {compared.length === 1 ? <p>再选择一个版本，查看两张图片的差异。</p> : <div className="compare-grid">{compared.map(item => <div key={item.id}><span>v{item.version}</span><button type="button" className="history-preview" aria-label={`放大对比版本 ${item.version}`} onClick={() => setPreview(item)}><img src={item.url} alt={`版本 ${item.version}`} /></button></div>)}</div>}
    </section>}
    <div className="history-preview-dialog"><Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) setPreview(null); }} title={`${asset.name} · v${preview?.version ?? ""}`} eyebrow="版本预览">{preview && <div className="history-preview-content"><img src={preview.url} alt={`${asset.name}，版本 ${preview.version}`} /><p>{preview.template}</p></div>}</Dialog></div>
  </div>;
}
