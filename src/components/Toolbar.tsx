import { Image, Layers3, PlaySquare, Save, CheckSquare, Sparkles, PanelRight, ImagePlus } from "lucide-react";
import { Button } from "./ui/button";
import type { OutputTarget } from "../api/contracts";

interface ToolbarProps {
  tab: OutputTarget;
  selectionMode: boolean;
  selectedCount: number;
  onTabChange: (tab: OutputTarget) => void;
  onToggleSelection: () => void;
  onGenerate: () => void;
  onClearData: () => void;
  onTogglePanel: () => void;
}

export function Toolbar({ tab, selectionMode, selectedCount, onTabChange, onToggleSelection, onGenerate, onClearData, onTogglePanel }: ToolbarProps) {
  return <aside className="toolbar">
    <button className={`tool-button ${tab === "base" ? "active" : ""}`} title="白底图" onClick={() => onTabChange("base")}><Image size={17} /><span>白底</span></button>
    <button className={`tool-button ${tab === "hero" ? "active" : ""}`} title="主图" onClick={() => onTabChange("hero")}><ImagePlus size={17} /><span>主图</span></button>
    <button className={`tool-button ${tab === "suite" ? "active" : ""}`} title="套图" onClick={() => onTabChange("suite")}><Layers3 size={17} /><span>套图</span></button>
    <button className={`tool-button ${tab === "video" ? "active" : ""}`} title="视频" onClick={() => onTabChange("video")}><PlaySquare size={17} /><span>视频</span></button>
    <div className="toolbar-separator" />
    {tab === "base" && <>
      <button className={`tool-button ${selectionMode ? "active" : ""}`} title="批量选择" onClick={onToggleSelection}><CheckSquare size={17} /><span>{selectedCount ? `已选 ${selectedCount}` : "批量"}</span></button>
      <button className="tool-button" title="生成白底图" onClick={onGenerate}><Sparkles size={17} /><span>生成</span></button>
    </>}
    {tab === "video" && <button className="tool-button" title="保存" onClick={onGenerate}><Save size={17} /><span>保存</span></button>}
    <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
      <button className="tool-button" title="收起面板" onClick={onTogglePanel}><PanelRight size={17} /><span>面板</span></button>
      <Button variant="ghost" size="icon" title="清除所有数据" onClick={onClearData}>×</Button>
    </div>
  </aside>;
}
