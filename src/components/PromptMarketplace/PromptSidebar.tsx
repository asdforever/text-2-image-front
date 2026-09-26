import { useMemo } from "react";
import { FolderPlus, Settings2 } from "lucide-react";
import type { ApiPromptCategory, ApiPromptTemplate } from "../../api/client";
import { filterPromptTemplates, type PromptCategoryFilter } from "../../lib/prompt-categories";

interface PromptSidebarProps {
  items: ApiPromptTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  categories: ApiPromptCategory[];
  activeCategory: PromptCategoryFilter;
  onCategorySelect: (category: PromptCategoryFilter) => void;
  onManageCategories: () => void;
}

export function PromptSidebar({ items, selectedId, onSelect, searchQuery, categories, activeCategory, onCategorySelect, onManageCategories }: PromptSidebarProps) {
  const filteredItems = useMemo(() => filterPromptTemplates(items, activeCategory, searchQuery), [items, activeCategory, searchQuery]);

  return (
    <aside className="prompt-sidebar">
      <div className="prompt-sidebar-header">
        <h3>提示词模板</h3>
        <span>{items.length} 个</span>
      </div>
      <div className="prompt-sidebar-content">
        <div className="prompt-category-section">
          <div className="prompt-category-toolbar"><strong>业务分类</strong><button type="button" title="分类管理" aria-label="分类管理" onClick={onManageCategories}><Settings2 size={13} /></button></div>
          <button type="button" className={`prompt-category-item ${activeCategory === "all" ? "active" : ""}`} onClick={() => onCategorySelect("all")}><span>全部</span><em>{items.length}</em></button>
          <button type="button" className={`prompt-category-item ${activeCategory === "uncategorized" ? "active" : ""}`} onClick={() => onCategorySelect("uncategorized")}><span>未分类</span><em>{items.filter((item) => !item.categoryId).length}</em></button>
          {categories.map((category) => <button type="button" key={category.id} title={category.name} className={`prompt-category-item ${activeCategory === category.id ? "active" : ""}`} onClick={() => onCategorySelect(category.id)}><span>{category.name}</span><em>{category.templateCount}</em></button>)}
          <button type="button" className="prompt-category-add" onClick={onManageCategories}><FolderPlus size={13} />管理分类</button>
        </div>
        <div className="prompt-list">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              className={`prompt-list-item ${selectedId === item.id ? "selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <strong>{item.name}</strong>
              <span className="prompt-list-code">{item.code}</span>
              <span className="prompt-list-version">v{item.defaultVersion?.versionNo ?? "-"}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
