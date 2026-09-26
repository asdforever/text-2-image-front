import type { ApiPromptTemplate } from "../../api/client";
import { PromptCard } from "./PromptCard";

interface PromptGridProps {
  items: ApiPromptTemplate[];
  selectedIds: Set<string>;
  batchMode: boolean;
  onEdit: (item: ApiPromptTemplate) => void;
  onTest: (item: ApiPromptTemplate) => void;
  onDuplicate: (item: ApiPromptTemplate) => void;
  onSelect: (item: ApiPromptTemplate) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

export function PromptGrid({ items, selectedIds, batchMode, onEdit, onTest, onDuplicate, onSelect, onDelete, onToggleSelect }: PromptGridProps) {
  if (items.length === 0) {
    return (
      <div className="prompt-grid-empty">
        <p>没有找到提示词模板</p>
        <span>尝试调整搜索条件或创建新的提示词</span>
      </div>
    );
  }

  return (
    <div className="prompt-grid">
      {items.map((item) => (
        <PromptCard
          key={item.id}
          item={item}
          isSelected={selectedIds.has(item.id)}
          batchMode={batchMode}
          onEdit={onEdit}
          onTest={onTest}
          onDuplicate={onDuplicate}
          onClick={onSelect}
          onDelete={onDelete}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
