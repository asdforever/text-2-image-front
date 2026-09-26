import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { projectApi, type ApiProject } from "../api/client";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";


interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: ApiProject) => void;
}

export function ProjectCreateDialog({ open, onOpenChange, onCreated }: ProjectCreateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ApiProject | null>(null);
  const busy = useRef(false);
  const nameEdited = useRef(false);

  useEffect(() => {
    if (!open) { setName(""); setFile(null); setError(null); setCreated(null); nameEdited.current = false; }
  }, [open]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const close = () => { if (!busy.current) onOpenChange(false); };
  const enterProject = (project: ApiProject) => {
    onOpenChange(false);
    void navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: { tab: "base" } });
  };
  const submit = async () => {
    if (busy.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError("请填写项目名称"); return; }
    busy.current = true; setSubmitting(true); setError(null);
    try {
      let project = created;
      if (!project) {
        project = await projectApi.create(trimmedName);
        setCreated(project);
        onCreated?.(project);
      }
      if (file) await projectApi.uploadAsset(project.id, "source", file);
      enterProject(project);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "保存失败，请稍后重试");
    } finally { busy.current = false; setSubmitting(false); }
  };

  return <Dialog open={open} onOpenChange={next => { if (!next) close(); }} title="创建项目" eyebrow="">
    <form className="project-create-content" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p>先上传商品图，进入工作台后再选择风格与模块。也可以先创建项目，稍后添加图片。</p>
      <label className="project-create-upload"><span>＋ 选择商品图片</span><input type="file" accept="image/*" aria-label="商品图片" disabled={submitting} onChange={event => {
        const next = event.target.files?.[0] ?? null;
        if (next && !next.type.startsWith("image/")) { setError("请选择图片文件"); event.target.value = ""; return; }
        setFile(next); setError(null);
        if (next && !created && !nameEdited.current) setName(next.name.replace(/\.[^.]+$/, ""));
      }} />{preview && <img src={preview} alt="待上传商品图片" />}</label>
      <div className="form-field"><label htmlFor="project-name">项目名称</label><Input id="project-name" value={name} placeholder="例如：65W 三口充电器" onChange={event => { nameEdited.current = true; setName(event.target.value); }} disabled={submitting || !!created} /></div>
      {created && <p>项目已创建。上传失败时可直接重试，或进入项目稍后上传。</p>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="dialog-footer"><Button type="button" variant="secondary" onClick={created ? () => enterProject(created) : close} disabled={submitting}>{created ? "进入项目稍后上传" : "取消"}</Button><Button type="submit" disabled={submitting}>{submitting ? (created ? "上传中…" : "创建中…") : created && file ? "重试上传" : "创建并进入工作台"}</Button></div>
    </form>
  </Dialog>;
}
