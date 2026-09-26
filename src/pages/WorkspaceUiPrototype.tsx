// 三种工作台交互原型：/workspace?variant=A|B|C。仅开发环境，状态不持久化。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Download, Folder, Grid2X2, Image as ImageIcon, Layers, List, Maximize2, Minus, MousePointer2, Plus, Search, SlidersHorizontal, Sparkles, Stamp, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Project } from "../api/contracts";
import "./workspace-ui-prototype.css";

type Variant = "A" | "B" | "C";
type Shot = { id: string; name: string; url: string; kind: string };
type Module = { name: string; count: number; note: string };
const variants: Variant[] = ["A", "B", "C"];
const variantNames = { A: "图片工作室", B: "步骤式工作台", C: "画布工作台" };
const seedShots: Shot[] = [
  { id: "sample-1", name: "商品正面", url: "/assets/gan65-product.jpg", kind: "白底图" },
  { id: "sample-2", name: "接口细节", url: "/assets/gan65-product-tight.jpg", kind: "细节图" },
  { id: "sample-3", name: "桌面场景参考", url: "/assets/tokyo-desk-v3.jpg", kind: "场景参考" },
];
const initialModules = [{ name: "商品主视觉", count: 1, note: "正面呈现产品，保留接口与标识" }, { name: "卖点特写", count: 1, note: "突出接口细节；不添加未经确认的参数" }, { name: "使用场景", count: 0, note: "" }];

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button className="up-icon" title={label} aria-label={label} onClick={onClick}>{children}</button>;
}

export function WorkspaceUiPrototype({ variant, projects }: { variant: Variant; projects: Project[] }) {
  const navigate = useNavigate({ from: "/workspace" });
  const [page, setPage] = useState("studio");
  const [name, setName] = useState("65W 充电器 · 电商图组");
  const [shots, setShots] = useState(seedShots);
  const [active, setActive] = useState("sample-1");
  const [source, setSource] = useState("sample-1");
  const [output, setOutput] = useState("主图");
  const [style, setStyle] = useState("极简棚拍");
  const [market, setMarket] = useState("天猫");
  const [ratio, setRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2K");
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"source" | "confirm" | "preview" | "create" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [prompt, setPrompt] = useState("保留商品外形、颜色、接口与标识。以选定素材为主体，采用清晰的商业产品摄影构图，突出产品轮廓与材质，不加入未经确认的功能和规格。");
  const [status, setStatus] = useState("待配置");
  const [zoom, setZoom] = useState(100);
  const [list, setList] = useState(false);
  const [customStyle, setCustomStyle] = useState("");
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const count = modules.reduce((total, module) => total + module.count, 0);
  const selected = shots.find((shot) => shot.id === active) ?? shots[0];
  const sourceShot = shots.find((shot) => shot.id === source) ?? shots[0];
  const changeVariant = (offset: number) => void navigate({ search: { variant: variants[(variants.indexOf(variant) + offset + 3) % 3] }, replace: true });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (modal) { if (event.key === "Escape") setModal(null); return; }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); changeVariant(event.key === "ArrowLeft" ? -1 : 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const openProject = (project?: Project, projectName?: string) => {
    setName(project?.name ?? projectName ?? name);
    if (project?.assets.length) {
      const next = project.assets.map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, kind: asset.type === "source" ? "原图" : asset.type === "base" ? "白底图" : "生成结果" }));
      setShots(next); setActive(next[0].id); setSource(next[0].id);
    }
    setPage("studio");
  };
  const generate = () => {
    setModal(null); setStatus("演示处理中");
    timer.current = setTimeout(() => {
      const results = modules.flatMap((module, index) => Array.from({ length: module.count }, (_, n) => ({ id: `demo-${Date.now()}-${index}-${n}`, name: `${module.name} ${n + 1}`, url: sourceShot.url, kind: "演示结果" })));
      setShots((current) => [...current, ...results]); setActive(results[0]?.id ?? source); setStatus("演示完成"); setStep(2);
    }, 1400);
  };
  const changeModule = (index: number, patch: Partial<Module>) => setModules((current) => current.map((module, i) => i === index ? { ...module, ...patch } : module));
  const primary = <button className="up-primary" disabled={!count || status === "演示处理中"} onClick={() => setModal("confirm")}><Sparkles size={16} />{status === "演示处理中" ? "演示处理中…" : `查看生成方案 · ${count} 张`}</button>;
  const settings = <>
    <div className="up-section-title"><h2>生成配置</h2><span>{count} 张</span></div>
    <section className="up-setting-section"><label>商品素材</label><button className="up-source" onClick={() => setModal("source")}><img src={sourceShot.url} alt="" /><span><strong>{sourceShot.name}</strong><small>{sourceShot.kind}</small></span><ChevronDown size={15} /></button></section>
    <section className="up-setting-section"><label>电商平台<select value={market} onChange={(e) => setMarket(e.target.value)}><optgroup label="国内"><option>天猫</option><option>京东</option><option>抖音电商</option></optgroup><optgroup label="国外"><option>Amazon</option><option>Shopify</option><option>TikTok Shop</option></optgroup></select></label></section>
    <section className="up-setting-section"><label>图片风格</label><div className="up-styles">{["极简棚拍", "杂志编辑", "自然场景", "自定义"].map((item, index) => <button key={item} className={style === item ? "is-active" : ""} onClick={() => setStyle(item)}><span className={`up-style-swatch swatch-${index}`} style={index === 2 ? { backgroundImage: 'url("/assets/tokyo-desk-v3.jpg")' } : undefined}>{index === 3 ? <Plus size={18} /> : <span className="up-style-object" />}</span><span>{item}</span>{style === item && <Check size={12} />}</button>)}</div>{style === "自定义" && <textarea aria-label="自定义风格" placeholder="填写色彩、光线和构图要求" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} />}</section>
    <section className="up-setting-section"><div className="up-section-title"><label>{output === "详情套图" ? "详情页模块" : "图片模块"}</label><small>每项 0–4 张</small></div><div className="up-modules">{modules.map((module, index) => <div className="up-module" key={module.name}><div><label><input type="checkbox" checked={module.count > 0} onChange={(e) => changeModule(index, { count: e.target.checked ? 1 : 0 })} />{module.name}</label><div className="up-stepper"><IconButton label={`减少${module.name}`} onClick={() => changeModule(index, { count: Math.max(0, module.count - 1) })}><Minus size={12} /></IconButton><output>{module.count}</output><IconButton label={`增加${module.name}`} onClick={() => changeModule(index, { count: Math.min(4, module.count + 1) })}><Plus size={12} /></IconButton></div></div>{module.count > 0 && <input className="up-module-note" aria-label={`${module.name}补充要求`} placeholder="补充参数或场景要求" value={module.note} onChange={(e) => changeModule(index, { note: e.target.value })} />}</div>)}</div></section>
    <section className="up-setting-section"><div className="up-fields"><label>比例<select value={ratio} onChange={(e) => setRatio(e.target.value)}><option>1:1</option><option>3:4</option><option>4:3</option><option>16:9</option></select></label><label>分辨率<select value={resolution} onChange={(e) => setResolution(e.target.value)}><option>1K</option><option>2K</option><option>4K</option></select></label></div><details className="up-advanced"><summary>模型与语言<ChevronDown size={13} /></summary><div className="up-fields"><label>模型<select defaultValue="当前已配置模型"><option>当前已配置模型</option></select></label><label>文字语言<select><option>简体中文</option><option>English</option></select></label></div></details></section>
  </>;
  const rail = <aside className="up-inspector"><div className="up-inspector-scroll">{settings}</div><footer><small>{market} · {ratio} · {resolution}</small>{primary}</footer></aside>;
  const thumbs = <div className="up-filmstrip">{shots.map((shot) => <button key={shot.id} className={active === shot.id ? "is-active" : ""} onClick={() => setActive(shot.id)}><img src={shot.url} alt={shot.name} /><span>{shot.name}</span></button>)}</div>;
  const stage = <div className="up-image-stage"><img style={{ transform: `scale(${zoom / 100})` }} src={selected.url} alt={selected.name} /><div className="up-image-label"><span>{selected.kind}</span><strong>{selected.name}</strong></div></div>;
  const tools = <div className="up-stage-tools"><div><IconButton label="缩小" onClick={() => setZoom((z) => Math.max(50, z - 10))}><ZoomOut size={16} /></IconButton><button className="up-zoom" onClick={() => setZoom(100)} title="恢复原始比例">{zoom}%</button><IconButton label="放大" onClick={() => setZoom((z) => Math.min(180, z + 10))}><ZoomIn size={16} /></IconButton></div><div><IconButton label="全屏预览" onClick={() => setModal("preview")}><Maximize2 size={16} /></IconButton><a className="up-icon" href={selected.url} download title="下载当前图片" aria-label="下载当前图片"><Download size={16} /></a></div></div>;
  const gallery = <div className={`up-gallery ${list ? "is-list" : ""}`}>{shots.filter((shot) => shot.name.includes(query)).map((shot) => <button key={shot.id} className={active === shot.id ? "is-active" : ""} onClick={() => { setActive(shot.id); setModal("preview"); }}><img src={shot.url} alt={shot.name} /><span><strong>{shot.name}</strong><small>{shot.kind}</small></span><Maximize2 size={14} /></button>)}</div>;

  return <div className={`ui-prototype up-variant-${variant}`}>
    <aside className="up-nav"><a className="up-brand" href="/workspace"><span><Layers size={20} /></span><strong>PicAgent<span>图片工作室</span></strong></a><button className="up-workspace-name">我的工作空间<ChevronDown size={14} /></button><nav><button className={page === "projects" ? "is-active" : ""} onClick={() => setPage("projects")}><Folder size={17} /><span>项目</span><small>{projects.length || 1}</small></button><button className={page === "studio" ? "is-active" : ""} onClick={() => setPage("studio")}><Sparkles size={17} /><span>创作工作台</span></button><button className={page === "assets" ? "is-active" : ""} onClick={() => setPage("assets")}><ImageIcon size={17} /><span>项目资产</span><small>{shots.length}</small></button></nav><div className="up-nav-group"><small>资源与管理</small><a href="/prompts"><Stamp size={17} />提示词</a><a href="/asset-libraries"><Layers size={17} />素材库</a><a href="/product-libraries"><Grid2X2 size={17} />成品库</a><a href="/test-product-libraries"><ImageIcon size={17} />测试库</a><a href="/generation-config"><SlidersHorizontal size={17} />生成配置</a></div><div className="up-nav-bottom"><span className="up-avatar">J</span><span>我的工作区<small>本地项目</small></span><a href="/workspace" className="up-icon" title="返回现有工作台" aria-label="返回现有工作台"><ArrowLeft size={16} /></a></div></aside>
    <main className="up-main"><header className="up-topbar"><div className="up-breadcrumb"><button onClick={() => setPage("projects")}>项目</button><ChevronRight size={14} /><span>{page === "projects" ? "全部项目" : name}</span></div><div className="up-top-actions"><span className="up-status"><i />{status}</span><button className="up-secondary" onClick={() => setPage(page === "assets" ? "studio" : "assets")}><Layers size={15} />{page === "assets" ? "返回创作" : "项目资产"}</button></div></header>
    {page === "studio" ? <><div className="up-project-header"><div><span className="up-eyebrow">当前项目</span><h1>{name}</h1></div><div className="up-output-tabs" role="tablist" aria-label="生成类型">{["白底图", "主图", "详情套图"].map((item) => <button role="tab" aria-selected={output === item} className={output === item ? "is-active" : ""} key={item} onClick={() => setOutput(item)}>{item}</button>)}</div></div>
      {variant === "A" && <VariantA rail={rail} stage={stage} tools={tools} thumbs={thumbs} />}
      {variant === "B" && <VariantB step={step} onStep={setStep} source={sourceShot} onSource={() => setModal("source")} settings={settings} stage={stage} gallery={gallery} primary={primary} thumbs={thumbs} />}
      {variant === "C" && <VariantC shots={shots} modules={modules} source={sourceShot} rail={rail} onSelect={(id) => { setActive(id); setModal("preview"); }} onSource={() => setModal("source")} />}
    </> : page === "projects" ? <div className="up-projects"><div className="up-page-heading"><div><h1>项目</h1><p>继续创作，或开始一个新商品。</p></div><button className="up-primary" onClick={() => { setDraftName(""); setModal("create"); }}><Plus size={16} />新建项目</button></div><div className="up-search"><Search size={17} /><input placeholder="搜索项目" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="up-project-list">{(projects.length ? projects.map((project) => ({ project, title: project.name, image: project.assets[0]?.url ?? seedShots[0].url })) : [{ project: undefined, title: name, image: shots[0].url }]).concat(projectNames.map((title) => ({ project: undefined, title, image: seedShots[0].url }))).filter((item) => item.title.includes(query)).map((item, i) => <button key={i} className="up-project-row" onClick={() => openProject(item.project, item.title)}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.project ? "已有项目" : "示例项目"}</small></span><span className="up-project-state">继续创作</span><ArrowRight size={18} /></button>)}</div></div> : <div className="up-projects"><div className="up-page-heading"><div><h1>项目资产</h1><p>{name} · {shots.length} 张图片</p></div><div className="up-view-toggle"><IconButton label="网格视图" onClick={() => setList(false)}><Grid2X2 size={17} /></IconButton><IconButton label="列表视图" onClick={() => setList(true)}><List size={17} /></IconButton></div></div><div className="up-search"><Search size={17} /><input placeholder="搜索图片" value={query} onChange={(e) => setQuery(e.target.value)} /></div>{gallery}</div>}
    </main>
    <div className="up-prototype-bar"><span>交互原型 · 演示数据</span><IconButton label="上一种设计" onClick={() => changeVariant(-1)}><ArrowLeft size={16} /></IconButton><strong>{variant} / {variantNames[variant]}</strong><IconButton label="下一种设计" onClick={() => changeVariant(1)}><ArrowRight size={16} /></IconButton><a href="/workspace" title="退出原型" aria-label="退出原型"><X size={16} /></a></div>
    {modal && <div className="up-modal-backdrop" onClick={() => setModal(null)}><section className={`up-modal ${modal === "preview" ? "up-preview" : ""}`} role="dialog" aria-modal="true" aria-label={modal === "confirm" ? "确认生成方案" : modal === "source" ? "选择商品素材" : modal === "create" ? "新建示例项目" : "图片预览"} onClick={(e) => e.stopPropagation()}><header><h2>{modal === "confirm" ? "确认生成方案" : modal === "source" ? "选择商品素材" : modal === "create" ? "新建示例项目" : selected.name}</h2><IconButton label="关闭弹窗" onClick={() => setModal(null)}><X size={18} /></IconButton></header>
      {modal === "preview" ? <><img src={selected.url} alt={selected.name} /><footer><span>{selected.kind}</span><button className="up-secondary" onClick={() => { setSource(selected.id); setModal(null); setPage("studio"); }}>用作生成素材<ArrowRight size={15} /></button></footer></> : modal === "source" ? <div className="up-source-grid">{shots.map((shot) => <button key={shot.id} className={source === shot.id ? "is-active" : ""} onClick={() => { setSource(shot.id); setModal(null); }}><img src={shot.url} alt="" /><strong>{shot.name}</strong><small>{shot.kind}</small>{source === shot.id && <Check size={16} />}</button>)}</div> : modal === "create" ? <form onSubmit={(e) => { e.preventDefault(); if (!draftName.trim()) return; setProjectNames((items) => [...items, draftName.trim()]); setName(draftName.trim()); setPage("studio"); setModal(null); }}><label>项目名称<input autoFocus required value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="例如：充电器新品图组" /></label><footer><span>仅保存在本次原型会话</span><button className="up-primary" type="submit">创建并进入<ArrowRight size={15} /></button></footer></form> : <><div className="up-confirm-summary"><img src={sourceShot.url} alt="商品素材" /><div><strong>{count} 张{output}</strong><p>{market} · {style} · {ratio} · {resolution}</p><small>{modules.filter((module) => module.count).map((module) => `${module.name} × ${module.count}`).join(" / ")}</small></div></div><label>任务提示词<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label><details><summary>平台与风格约束</summary><p>平台：{market}；风格：{style === "自定义" ? customStyle : style}。保留商品真实性，不添加未经确认的信息。</p></details><footer><span>模拟流程，复用素材预览，不调用生图</span><button className="up-primary" disabled={!prompt.trim() || !count} onClick={generate}><Sparkles size={16} />确认演示</button></footer></>}
    </section></div>}
  </div>;
}

export function VariantA({ rail, stage, tools, thumbs }: { rail: ReactNode; stage: ReactNode; tools: ReactNode; thumbs: ReactNode }) {
  return <div className="up-studio"><section className="up-stage-column"><div className="up-stage-caption"><span>图片预览</span><span>当前版本</span></div>{stage}{tools}{thumbs}</section>{rail}</div>;
}

export function VariantB({ step, onStep, source, onSource, settings, stage, gallery, primary, thumbs }: { step: number; onStep: (step: number) => void; source: Shot; onSource: () => void; settings: ReactNode; stage: ReactNode; gallery: ReactNode; primary: ReactNode; thumbs: ReactNode }) {
  return <div className="up-guided"><nav className="up-steps" aria-label="创作步骤">{["选择商品素材", "配置图片方案", "查看生成结果"].map((label, i) => <button key={label} className={i === step ? "is-active" : ""} onClick={() => onStep(i)}><span>{i < step ? <Check size={15} /> : i + 1}</span><strong>{label}</strong></button>)}</nav><div className="up-guided-body">{step === 0 ? <div className="up-guided-source"><div><span className="up-eyebrow">01 / 商品素材</span><h2>从一张商品图开始</h2><p>{source.name}</p><button className="up-secondary" onClick={onSource}><ImageIcon size={16} />选择项目素材</button></div><img src={source.url} alt={source.name} /></div> : step === 1 ? <div className="up-guided-settings"><div>{settings}</div><div>{stage}</div></div> : <div className="up-guided-results"><h2>本次项目图片</h2>{gallery}{thumbs}</div>}</div><footer className="up-guided-footer"><button className="up-secondary" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft size={15} />上一步</button>{step === 0 ? <button className="up-primary" onClick={() => onStep(1)}>配置图片方案<ArrowRight size={15} /></button> : primary}</footer></div>;
}

export function VariantC({ shots, modules, source, rail, onSelect, onSource }: { shots: Shot[]; modules: Module[]; source: Shot; rail: ReactNode; onSelect: (id: string) => void; onSource: () => void }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(100);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  return <div className="up-studio up-board-layout"><section className="up-board" onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button, a")) return; drag.current = { x: e.clientX, y: e.clientY, startX: offset.x, startY: offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (drag.current) setOffset({ x: drag.current.startX + e.clientX - drag.current.x, y: drag.current.startY + e.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><div className="up-board-toolbar"><MousePointer2 size={17} /><span>创作画布</span><button onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(100); }}>适应视图</button></div><div className="up-board-content" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100})` }}><div className="up-board-source"><small>商品素材</small><button onClick={onSource}><img src={source.url} alt={source.name} /><span>{source.name}<ChevronDown size={14} /></span></button></div><div className="up-board-tasks"><small>图片任务</small>{modules.filter((module) => module.count).map((module, i) => <div className="up-board-task" key={module.name}><header><span>0{i + 1}</span><strong>{module.name}</strong><small>{module.count} 张</small></header><p>{module.note || "待补充画面要求"}</p><span className="up-board-task-status">待确认</span></div>)}</div><div className="up-board-results"><small>图片资产</small>{shots.slice(-3).map((shot) => <button key={shot.id} onClick={() => onSelect(shot.id)}><img src={shot.url} alt={shot.name} /><span>{shot.name}</span></button>)}</div></div><div className="up-board-zoom"><IconButton label="缩小画布" onClick={() => setZoom((value) => Math.max(40, value - 10))}><Minus size={15} /></IconButton><span>{zoom}%</span><IconButton label="放大画布" onClick={() => setZoom((value) => Math.min(150, value + 10))}><Plus size={15} /></IconButton></div></section>{rail}</div>;
}
