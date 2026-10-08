import { FolderKanban, LayoutDashboard, ListTodo, PanelLeftClose, PanelLeftOpen, Store, Image, Package, SlidersHorizontal, Layers3, ScanSearch } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ThemeToggle } from "./ThemeToggle";

const items = [
  { href: "/workspace", label: "工作台", icon: LayoutDashboard },
  { href: "/projects", label: "项目管理", icon: FolderKanban },
  { href: "/reverse-projects", label: "爆品图反推", icon: ScanSearch },
  { href: "/prompts", label: "提示词商城", icon: Store },
  { href: "/tasks", label: "任务中心", icon: ListTodo },
  { href: "/asset-libraries", label: "素材库", icon: Image },
  { href: "/product-libraries", label: "成品库", icon: Package },
  { href: "/generation-config", label: "生成配置", icon: SlidersHorizontal },
];

export function GlobalSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  if (import.meta.env.DEV && path === "/workspace" && ["A", "B", "C"].includes(new URLSearchParams(location.searchStr).get("variant") ?? "")) return null;

  return (
    <aside className={`global-sidebar ${collapsed ? "collapsed" : ""}`} aria-label="主导航">
      <Link to="/workspace" search={{ variant: undefined }} className="studio-brand" aria-label="图片工作室首页"><span><Layers3 size={21} /></span><strong>图片工作室<small>PicAgent Studio</small></strong></Link>
      <nav>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/workspace"
            ? path === href || path.startsWith("/projects/") || path.startsWith("/suites/")
            : href === "/projects" ? path === href || path === "/" : path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              to={href}
              activeOptions={{ exact: href === "/projects" }}
              className={`global-nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={label}
              aria-label={label}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="global-sidebar-footer">
        <span className="studio-account">个人工作区<small>本地项目</small></span>
        <ThemeToggle />
        <button
          className="global-sidebar-toggle"
          type="button"
          aria-label={collapsed ? "展开导航" : "收起导航"}
          title={collapsed ? "展开导航" : "收起导航"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </aside>
  );
}
