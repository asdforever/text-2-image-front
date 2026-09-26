export type EditTool = "none" | "add_text" | "change_text" | "inpaint" | "crop_resize";
export type Region = { x: number; y: number; width: number; height: number; rotation: number };
export type MaskStroke = { mode: "draw" | "erase"; points: { x: number; y: number }[]; width: number };
export type TextStyle = { fontFamily: string; fontSize: number; color: string; align: "left" | "center" | "right"; strokeColor: string; strokeWidth: number };
export type DraftOperation = { operationId: string; type: string; summary: string; sourceVersionId: string; payload: Record<string, unknown> };
export type EditorDraft = {
  tool: EditTool; id: string; text: string; originalText: string; newText: string; prompt: string;
  region: Region; strokes: MaskStroke[]; feather: number; action: "redraw" | "erase";
  textStyle: TextStyle; crop: Region; width: number; height: number; lockRatio: boolean;
};
export const freshId = () => globalThis.crypto.randomUUID();
export const defaultRegion: Region = { x: .2, y: .4, width: .6, height: .15, rotation: 0 };
export const fullRegion: Region = { x: 0, y: 0, width: 1, height: 1, rotation: 0 };
export function initialDraft(width: number, height: number): EditorDraft {
  return { tool: "none", id: freshId(), text: "", originalText: "", newText: "", prompt: "", region: { ...defaultRegion }, strokes: [], feather: .08, action: "redraw", textStyle: { fontFamily: "Microsoft YaHei", fontSize: 48, color: "#ffffff", align: "center", strokeColor: "#000000", strokeWidth: 0 }, crop: { ...fullRegion }, width, height, lockRatio: true };
}
export function operationFromDraft(draft: EditorDraft, sourceVersionId: string): DraftOperation {
  const type = draft.tool === "inpaint" ? draft.action : draft.tool;
  const summary = type === "add_text" ? `添加文本：${draft.text}` : type === "change_text" ? `改文字：${draft.originalText} → ${draft.newText}` : type === "erase" ? "局部重绘：移除选中内容" : type === "redraw" ? "局部重绘：修改选中内容" : `裁剪与尺寸：${draft.width} × ${draft.height}`;
  const payload = type === "crop_resize" ? { region: draft.crop, width: draft.width, height: draft.height } : type === "add_text" ? { text: draft.text, region: draft.region, textStyle: draft.textStyle, prompt: draft.prompt } : type === "change_text" ? { originalText: draft.originalText, newText: draft.newText, region: draft.region, prompt: draft.prompt } : { strokes: draft.strokes, feather: draft.feather, prompt: draft.prompt || (type === "erase" ? "移除选中内容，自然补全背景，保持光影和纹理一致" : "") };
  return { operationId: draft.id, type, summary, sourceVersionId, payload: { schemaVersion: 2, ...payload } };
}
export function draftFromOperation(item: DraftOperation, width: number, height: number): EditorDraft {
  const p = item.payload;
  return { ...initialDraft(width, height), tool: ["redraw", "erase"].includes(item.type) ? "inpaint" : item.type as EditTool, id: item.operationId,
    text: String(p.text ?? ""), originalText: String(p.originalText ?? ""), newText: String(p.newText ?? ""), prompt: String(p.prompt ?? ""),
    region: p.region as Region ?? { ...defaultRegion }, crop: p.region as Region ?? { ...fullRegion }, strokes: p.strokes as MaskStroke[] ?? [], feather: Number(p.feather ?? .08), action: item.type === "erase" ? "erase" : "redraw",
    textStyle: { ...initialDraft(width, height).textStyle, ...p.textStyle as Partial<TextStyle> }, width: Number(p.width ?? width), height: Number(p.height ?? height) };
}
export function isSupportedOperation(item: DraftOperation) { return ["add_text", "change_text", "redraw", "erase", "crop_resize"].includes(item.type); }
export function validateDraft(d: EditorDraft): string {
  if (d.tool === "none") return "请先选择编辑工具";
  if (d.tool === "add_text" && !d.text.trim()) return "请填写要添加的文字";
  if (d.tool === "add_text" && (!Number.isFinite(d.textStyle.fontSize) || d.textStyle.fontSize < 8 || d.textStyle.fontSize > 1000 || !Number.isFinite(d.textStyle.strokeWidth) || d.textStyle.strokeWidth < 0 || d.textStyle.strokeWidth > 20)) return "字号需为 8–1000，描边宽度需为 0–20";
  if (d.tool === "change_text" && (!d.originalText.trim() || !d.newText.trim())) return "请填写原文字和新文字";
  if (d.tool === "inpaint" && !d.strokes.some(s => s.mode === "draw")) return "请先涂选需要修改的区域";
  if (d.tool === "inpaint" && d.action === "redraw" && !d.prompt.trim()) return "请填写重绘要求";
  const r = d.tool === "crop_resize" ? d.crop : d.region;
  if (["add_text", "change_text", "crop_resize"].includes(d.tool) && (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x+r.width > 1.000001 || r.y+r.height > 1.000001)) return "请在原图范围内选择有效区域";
  if (d.tool === "crop_resize" && (![d.width,d.height].every(n => Number.isInteger(n) && n > 0 && n <= 30000) || d.width*d.height > 32000000)) return "尺寸需为 1–30000 的整数，总像素不超过 3200 万";
  return "";
}
export function cropForRatio(ratio: string, width: number, height: number): Region {
  if (ratio === "original") return { ...fullRegion };
  const [a,b] = ratio.split(":").map(Number), target = a / b, original = width / height;
  const w = target < original ? target / original : 1, h = target > original ? original / target : 1;
  return { x: (1-w)/2, y: (1-h)/2, width: w, height: h, rotation: 0 };
}
