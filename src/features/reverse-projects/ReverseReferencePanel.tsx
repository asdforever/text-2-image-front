import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { reverseProjectsApi, type ReverseTarget } from "../../api/reverse-projects";
import { Button } from "../../components/ui/button";
import type { CommonGenerationConfig } from "../../lib/generation-workspace";
import { moduleReverseReference } from "./planning";
import { ReferencePickerDialog } from "./ReferencePickerDialog";
import type { ReverseBindingControls } from "./useReverseBindings";
import { errorMessage } from "./shared";

export function ReverseReferencePanel({ projectId, target, controls, disabled }: { projectId: string; target: ReverseTarget; controls?: ReverseBindingControls; disabled?: boolean }) {
  const [picker, setPicker] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (!controls) return null;
  const binding = controls.bindings.find(b => b.scope === "overall");
  async function remove() {
    if (!binding || !controls || busy) return; setBusy(true); setError("");
    try { await reverseProjectsApi.unbind(projectId, binding.id); await controls.refresh(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <div className="rp-planner-reference" aria-label="规划大师反推参考"><div className="rp-reference-title"><strong>爆品反推参考</strong><small>整体策略</small></div>{controls.loading ? <p>正在同步引用…</p> : binding ? <div className="rp-reference-bound"><strong>{binding.reverseProjectName} · v{binding.versionNo}</strong><p>学习内容顺序、统一视觉与模块组合。</p><Link to="/reverse-projects/$reverseProjectId" params={{ reverseProjectId: binding.reverseProjectId }} search={{ tab: "overall" }}>查看反推项目</Link></div> : <p>选择一套已发布方案，供规划大师学习整体表达。</p>}<div className="rp-actions"><Button size="sm" variant="secondary" disabled={disabled || busy || controls.loading} onClick={() => setPicker(true)}>{binding ? "更换反推项目" : "选择反推项目"}</Button>{binding && <Button size="sm" variant="ghost" disabled={disabled || busy || controls.loading} onClick={() => void remove()}>解除引用</Button>}</div>{(error || controls.error) && <div className="rp-reference-error" role="alert">{error || controls.error}<button type="button" onClick={() => void controls.refresh().catch(() => undefined)}>重新读取</button></div>}{picker && <ReferencePickerDialog projectId={projectId} target={target} onClose={() => setPicker(false)} onSelected={controls.refresh} />}</div>;
}

export function ReverseModuleReferencePicker({ projectId, target, taskId, config, controls, disabled }: { projectId: string; target: ReverseTarget; taskId: string; config: CommonGenerationConfig; controls?: ReverseBindingControls; disabled?: boolean }) {
  const [picker, setPicker] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (!controls) return null;
  const binding = controls.bindings.find(b => b.scope === "module" && b.targetModuleId === taskId);
  const inherited = !binding ? moduleReverseReference(config, taskId) : undefined;
  const overall = controls.bindings.find(b => b.scope === "overall");
  async function remove() {
    if (!binding || !controls || busy) return; setBusy(true); setError("");
    try { await reverseProjectsApi.unbind(projectId, binding.id); await controls.refresh(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <div className="rp-module-reference" aria-label="模块反推参考"><strong>模块参考</strong><p>{binding ? binding.reverseProjectName + " / " + binding.sourceModuleTitle + " · v" + binding.versionNo : inherited ? "使用规划大师匹配的模块 · " + (overall ? "v" + overall.versionNo : "固定版本") : overall ? "沿用整体方案，可单独选择局部参考。" : "可单独借鉴一张图的构图与细节。"}</p><div className="rp-actions"><button type="button" disabled={disabled || controls.loading || busy} onClick={() => setPicker(true)}>{binding ? "更换模块参考" : "选择模块参考"}</button>{binding && <button type="button" disabled={disabled || controls.loading || busy} onClick={() => void remove()}>恢复默认</button>}</div>{error && <p role="alert">{error}</p>}{picker && <ReferencePickerDialog projectId={projectId} target={target} taskId={taskId} onClose={() => setPicker(false)} onSelected={controls.refresh} />}</div>;
}
