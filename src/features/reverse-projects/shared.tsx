import React, { type ReactNode } from "react";
import { Image, RefreshCw } from "lucide-react";
import type { ReverseProject, ReverseReferenceImage } from "../../api/reverse-projects";
import { Button } from "../../components/ui/button";

export function ReverseShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <div className="app-shell rp-shell"><header className="app-topbar"><div className="workspace-title"><strong>爆品图反推</strong><span>{title}</span></div>{actions}</header><main className="rp-main">{children}</main></div>;
}
export function ReferenceCover({ images }: { images: ReverseReferenceImage[] }) {
  return <div className={"rp-cover " + (images.length > 1 ? "rp-cover-multiple" : "")} aria-hidden="true">{images.length ? images.slice(0, 3).map(image => <img key={image.id} src={image.previewUrl} alt="" loading="lazy" />) : <div className="rp-cover-empty"><Image size={30} /><span>等待上传参考套图</span></div>}</div>;
}
export function ProjectStatus({ project }: { project: ReverseProject }) {
  const latest = project.versions.find(v => v.id === project.latestVersionId);
  const published = latest?.revision === project.revision;
  return <span className={"rp-badge " + (published ? "is-published" : "")}>{project.analysis.status === "running" ? "反推中" : published ? "已发布 · v" + latest.versionNo : latest ? "有未发布修改" : "草稿"}</span>;
}
export function ReverseError({ error, retry }: { error: string; retry?: () => void }) {
  if (!error) return null;
  return <div className="rp-error" role="alert"><span>{error}</span>{retry && <Button size="sm" variant="secondary" onClick={retry}><RefreshCw size={13} />重试</Button>}</div>;
}
export function EmptyReverse({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="rp-empty"><Image size={30} /><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "操作未完成，请重试";
export const introductionFields = [
  ["summary", "项目简介", "概括这套参考的表达特点"],
  ["suitableFor", "适用商品", "适合哪些品类或产品特征"],
  ["goal", "主要目标", "希望解决哪种购买疑虑"],
  ["requiredMaterials", "所需素材", "套用方案需要哪些商品图或资料"],
  ["notSuitableFor", "不适合情况", "哪些商品不宜采用这套方案"],
] as const;
export const overallFields = [
  ["contentFlow", "内容顺序"], ["visualSystem", "统一视觉"],
  ["moduleStrategy", "模块组合"], ["adaptationRules", "应用规则"],
] as const;
export const moduleFields = [
  ["goal", "模块目标"], ["layout", "构图"], ["informationHierarchy", "信息层级"],
  ["typography", "文字排版"], ["colorAndLighting", "色彩与光线"], ["adaptationNotes", "迁移建议"],
] as const;
