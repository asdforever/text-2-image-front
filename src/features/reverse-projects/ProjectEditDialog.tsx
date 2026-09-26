import React, { useState } from "react";
import { reverseProjectsApi, type ReverseProject } from "../../api/reverse-projects";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { errorMessage, introductionFields, ReverseError } from "./shared";

export function ProjectEditDialog({ project, onClose, onSaved }: { project?: ReverseProject; onClose: () => void; onSaved: (project: ReverseProject) => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [category, setCategory] = useState(project?.category ?? "");
  const [intro, setIntro] = useState(Object.fromEntries(introductionFields.map(([key]) => [key, project?.[key] ?? ""])) as Record<(typeof introductionFields)[number][0], string>);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true); setError("");
    try { onSaved(project ? await reverseProjectsApi.update(project.id, { expectedRevision: project.revision, name: name.trim(), category: category.trim(), ...intro }) : await reverseProjectsApi.create({ name: name.trim(), category: category.trim() })); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }} title={project ? "编辑反推项目" : "新建反推项目"} eyebrow="爆品图反推"><form className="rp-dialog-form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <p>一套参考图对应一个项目，保存整体设计方法与每张图的细节。</p>
    <label className="rp-field">项目名称<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="例如：便携家电的场景与细节表达" /></label>
    <label className="rp-field">品类<input maxLength={100} value={category} onChange={e => setCategory(e.target.value)} placeholder="例如：数码配件、小家电" /></label>
    {project && introductionFields.map(([key, label, placeholder]) => <label className="rp-field" key={key}>{label}<textarea rows={2} maxLength={2000} value={intro[key]} placeholder={placeholder} onChange={e => setIntro({ ...intro, [key]: e.target.value })} /></label>)}
    <ReverseError error={error} /><footer className="rp-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? "保存中…" : project ? "保存项目" : "创建并上传参考图"}</Button></footer>
  </form></Dialog>;
}
