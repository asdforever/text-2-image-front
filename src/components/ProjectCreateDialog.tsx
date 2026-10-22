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
  initialTab?: "base" | "canvas";
}

export function ProjectCreateDialog({ open, onOpenChange, onCreated, initialTab = "base" }: ProjectCreateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!open) { setName(""); setError(null); }
  }, [open]);

  const close = () => { if (!busy.current) onOpenChange(false); };
  const enterProject = (project: ApiProject) => {
    onOpenChange(false);
    void navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: { tab: initialTab } });
  };
  const submit = async () => {
    if (busy.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError("请填写项目名称"); return; }
    busy.current = true; setSubmitting(true); setError(null);
    try {
      const project = await projectApi.create(trimmedName);
      onCreated?.(project);
      enterProject(project);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "保存失败，请稍后重试");
    } finally { busy.current = false; setSubmitting(false); }
  };

  return <Dialog open={open} onOpenChange={next => { if (!next) close(); }} title="创建项目" eyebrow="">
    <form className="project-create-content" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p>创建项目后进入工作台，再添加商品素材并选择风格与模块。</p>
      <div className="form-field"><label htmlFor="project-name">项目名称</label><Input id="project-name" value={name} placeholder="例如：65W 三口充电器" onChange={event => setName(event.target.value)} disabled={submitting} /></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="dialog-footer"><Button type="button" variant="secondary" onClick={close} disabled={submitting}>取消</Button><Button type="submit" disabled={submitting}>{submitting ? "创建中…" : "创建并进入工作台"}</Button></div>
    </form>
  </Dialog>;
}
