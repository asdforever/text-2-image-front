import React, { useState } from "react";
import { reverseProjectsApi, type ReverseModule, type ReverseProject } from "../../api/reverse-projects";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { errorMessage, moduleFields, overallFields, ReverseError } from "./shared";

export function AnalysisEditDialog({ project, module, kind, onClose, onSaved }: { project: ReverseProject; module?: ReverseModule; kind: "overall" | "module"; onClose: () => void; onSaved: (project: ReverseProject) => void }) {
  const [overall, setOverall] = useState(project.overall);
  const [draft, setDraft] = useState<ReverseModule>(module ?? { id: crypto.randomUUID(), title: "", referenceImageId: project.references[0]?.id ?? "", goal: "", layout: "", informationHierarchy: "", typography: "", colorAndLighting: "", adaptationNotes: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() {
    if (busy) return; setBusy(true); setError("");
    try { onSaved(await reverseProjectsApi.update(project.id, { expectedRevision: project.revision, ...(kind === "overall" ? { overall } : { modules: module ? project.modules.map(m => m.id === module.id ? draft : m) : [...project.modules, draft] }) })); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Dialog open title={kind === "overall" ? "编辑整体反推" : module ? "编辑模块拆解" : "添加模块拆解"} eyebrow="反推草稿" onOpenChange={open => { if (!open && !busy) onClose(); }}><form className="rp-dialog-form" onSubmit={e => { e.preventDefault(); void save(); }}>
    <p>编辑仅保存到草稿，已有项目仍使用原来绑定的已发布版本。</p>
    {kind === "overall" ? overallFields.map(([key, label]) => <label className="rp-field" key={key}>{label}<textarea required rows={3} maxLength={5000} value={overall[key]} onChange={e => setOverall({ ...overall, [key]: e.target.value })} /></label>) : <>
      <label className="rp-field">模块名称<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="rp-field">对应参考图<select required value={draft.referenceImageId} onChange={e => setDraft({ ...draft, referenceImageId: e.target.value })}><option value="" disabled>请选择参考图</option>{project.references.map(r => <option key={r.id} value={r.id}>{r.ordinal}. {r.filename}</option>)}</select></label>
      {moduleFields.map(([key, label]) => <label className="rp-field" key={key}>{label}<textarea required={key === "goal" || key === "layout"} rows={2} maxLength={5000} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
    </>}
    <ReverseError error={error} /><footer className="rp-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy}>{busy ? "保存中…" : "保存草稿"}</Button></footer>
  </form></Dialog>;
}
