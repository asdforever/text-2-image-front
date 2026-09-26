import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, RefreshCw } from "lucide-react";
import type { Asset, AssetLibrary } from "../types/asset";
import {
  fetchImageLibraries,
  fetchUsableLibraryImages,
  toggleLibraryAssetSelection,
} from "../lib/base-image-library-selection";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Select } from "./ui/select";

interface BaseImageLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assets: Asset[]) => void;
}

type LoadStatus = "idle" | "loading" | "ready" | "error";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "素材库加载失败，请重试";
}

export function BaseImageLibraryPicker({ open, onOpenChange, onConfirm }: BaseImageLibraryPickerProps) {
  const [libraries, setLibraries] = useState<AssetLibrary[]>([]);
  const [libraryId, setLibraryId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<LoadStatus>("idle");
  const [assetStatus, setAssetStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState("");
  const libraryRequestRef = useRef(0);
  const assetRequestRef = useRef(0);

  const loadAssets = useCallback(async (nextLibraryId: string) => {
    const requestId = ++assetRequestRef.current;
    setLibraryId(nextLibraryId);
    setSelected([]);
    setAssets([]);
    setError("");
    if (!nextLibraryId) {
      setAssetStatus("idle");
      return;
    }
    setAssetStatus("loading");
    try {
      const nextAssets = await fetchUsableLibraryImages(nextLibraryId);
      if (requestId !== assetRequestRef.current) return;
      setAssets(nextAssets);
      setAssetStatus("ready");
    } catch (nextError) {
      if (requestId !== assetRequestRef.current) return;
      setError(errorMessage(nextError));
      setAssetStatus("error");
    }
  }, []);

  const loadLibraries = useCallback(async () => {
    const requestId = ++libraryRequestRef.current;
    assetRequestRef.current += 1;
    setLibraryStatus("loading");
    setAssetStatus("idle");
    setLibraries([]);
    setLibraryId("");
    setAssets([]);
    setSelected([]);
    setError("");
    try {
      const nextLibraries = await fetchImageLibraries();
      if (requestId !== libraryRequestRef.current) return;
      setLibraries(nextLibraries);
      setLibraryStatus("ready");
      if (nextLibraries[0]) await loadAssets(nextLibraries[0].id);
    } catch (nextError) {
      if (requestId !== libraryRequestRef.current) return;
      setError(errorMessage(nextError));
      setLibraryStatus("error");
    }
  }, [loadAssets]);

  useEffect(() => {
    if (!open) return;
    void loadLibraries();
    return () => {
      libraryRequestRef.current += 1;
      assetRequestRef.current += 1;
    };
  }, [open, loadLibraries]);

  const close = () => onOpenChange(false);
  const confirm = () => {
    if (selected.length === 0) return;
    onConfirm(selected);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="从素材库选择原图" eyebrow="ASSET LIBRARY">
      <div className="dialog-body library-picker">
        {libraryStatus === "loading" && <div className="library-picker-state" role="status">正在加载图片素材库...</div>}

        {libraryStatus === "error" && (
          <div className="library-picker-state is-error" role="alert">
            <ImageIcon size={20} />
            <strong>素材库暂时不可用</strong>
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void loadLibraries()}><RefreshCw size={13} />重试</Button>
          </div>
        )}

        {libraryStatus === "ready" && libraries.length === 0 && (
          <div className="library-picker-state">
            <ImageIcon size={20} />
            <strong>暂无图片素材库</strong>
            <span>你仍可以关闭窗口并提交本地原图。</span>
          </div>
        )}

        {libraryStatus === "ready" && libraries.length > 0 && (
          <>
            <label className="form-field library-picker-library">
              <span>图片素材库</span>
              <Select value={libraryId} onChange={(event) => void loadAssets(event.target.value)}>
                {libraries.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}
              </Select>
            </label>

            {assetStatus === "loading" && <div className="library-picker-state" role="status">正在加载图片素材...</div>}
            {assetStatus === "error" && (
              <div className="library-picker-state is-error" role="alert">
                <strong>图片加载失败</strong>
                <span>{error}</span>
                <Button variant="secondary" size="sm" onClick={() => void loadAssets(libraryId)}><RefreshCw size={13} />重试</Button>
              </div>
            )}
            {assetStatus === "ready" && assets.length === 0 && (
              <div className="library-picker-state"><strong>这个素材库还没有可用图片</strong><span>可以切换其他图片素材库。</span></div>
            )}
            {assetStatus === "ready" && assets.length > 0 && (
              <div className="library-picker-grid" aria-label="图片素材">
                {assets.map((asset) => {
                  const active = selected.some((item) => item.libraryId === asset.libraryId && item.id === asset.id);
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      className={`library-picker-item ${active ? "is-selected" : ""}`}
                      aria-label={`${active ? "取消选择" : "选择"} ${asset.name}`}
                      aria-pressed={active}
                      onClick={() => setSelected((current) => toggleLibraryAssetSelection(current, asset))}
                    >
                      <span className="library-picker-thumb"><img src={asset.url} alt="" /></span>
                      <strong title={asset.name}>{asset.name}</strong>
                      <small>{asset.width && asset.height ? `${asset.width} x ${asset.height}` : "原始尺寸"}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="dialog-footer library-picker-footer">
          <span>{selected.length ? `已选 ${selected.length} 张` : "请选择要加入项目的原图"}</span>
          <Button variant="ghost" onClick={close}>取消</Button>
          <Button disabled={selected.length === 0 || libraryStatus === "loading" || assetStatus === "loading"} onClick={confirm} aria-label={`确认添加 ${selected.length} 张`}>确认添加</Button>
        </div>
      </div>
    </Dialog>
  );
}
