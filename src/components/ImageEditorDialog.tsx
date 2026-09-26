import { useEffect, useState } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import { mockEditImage } from "../api/fixtures";
import type { Asset } from "../api/contracts";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Textarea } from "./ui/textarea";

export function ImageEditorDialog({ asset, open, onOpenChange, onSaved }: { asset?: Asset; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (version: Asset["versions"][number]) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!asset) return;
    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = asset.url;
    return () => setImage(undefined);
  }, [asset]);
  if (!asset) return null;
  const save = async () => { setBusy(true); const version = await mockEditImage(asset.id); setBusy(false); onOpenChange(false); onSaved(version); };
  return <Dialog open={open} onOpenChange={onOpenChange} title={`编辑 ${asset.name}`}><div className="dialog-body"><div style={{ display: "grid", placeItems: "center", minHeight: 270, background: "#111418", borderRadius: 5 }}><Stage width={500} height={270}><Layer>{image && <KonvaImage image={image} x={45} y={10} width={410} height={250} fit="contain" />}</Layer></Stage></div><div className="toolbar-actions" style={{ marginTop: 12 }}><Button size="sm" variant="secondary">添加文字</Button><Button size="sm" variant="secondary">局部重绘</Button><Button size="sm" variant="secondary">消除</Button></div><div className="form-field" style={{ marginTop: 15 }}><label>编辑备注</label><Textarea value={note} placeholder="描述这次编辑的改动" onChange={(event) => setNote(event.target.value)} /></div><div className="dialog-footer"><Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "保存中..." : "保存为新版本"}</Button></div></div></Dialog>;
}
