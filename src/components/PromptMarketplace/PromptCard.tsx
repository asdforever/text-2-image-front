import { Edit3, Play, Copy, Trash2 } from "lucide-react";
import type { ApiPromptTemplate } from "../../api/client";
import { Button } from "../ui/button";

interface PromptCardProps {
  item: ApiPromptTemplate;
  isSelected: boolean;
  batchMode: boolean;
  onEdit: (item: ApiPromptTemplate) => void;
  onTest: (item: ApiPromptTemplate) => void;
  onDuplicate: (item: ApiPromptTemplate) => void;
  onClick: (item: ApiPromptTemplate) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

export function PromptCard({ item, isSelected, batchMode, onEdit, onTest, onDuplicate, onClick, onDelete, onToggleSelect }: PromptCardProps) {
  return (
    <article className={`prompt-card ${isSelected ? "selected" : ""}`}>
      <div className="prompt-card-header">
        <div className="prompt-card-select">
          {batchMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(item.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className="prompt-card-category">{item.categoryName || "未分类"}</span>
        </div>
        <div className="prompt-card-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            title="编辑"
          >
            <Edit3 size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onTest(item);
            }}
            title="快速测试"
          >
            <Play size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(item);
            }}
            title="创建新版本"
          >
            <Copy size={13} />
          </Button>
          {!batchMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="删除"
              className="prompt-delete-btn"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>
      <div onClick={() => onClick(item)} style={{ cursor: "pointer", flex: 1 }}>
        <h2>{item.name}</h2>
        <p>
          {item.code} · 默认 v{item.defaultVersion?.versionNo ?? "-"} · {item.versionCount} 个版本
        </p>
        <div className="prompt-card-footer">
          <span className="prompt-card-date">
            {new Date(item.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </article>
  );
}
