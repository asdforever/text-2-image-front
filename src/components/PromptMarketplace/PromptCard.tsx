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
              aria-label={`选择提示词 ${item.name}`}
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
            aria-label={`编辑提示词 ${item.name}`}
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
            aria-label={`测试提示词 ${item.name}`}
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
            aria-label={`查看版本 ${item.name}`}
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
              aria-label={`删除提示词 ${item.name}`}
              className="prompt-delete-btn"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>
      <div className="prompt-card-body">
        <h2><button type="button" className="prompt-card-open" aria-label={`查看提示词 ${item.name}`} onClick={() => onClick(item)}>{item.name}</button></h2>
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
