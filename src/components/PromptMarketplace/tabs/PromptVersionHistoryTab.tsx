import { Edit3, Copy, CheckCircle2, Star } from "lucide-react";
import type { ApiPromptVersion, ApiPromptTemplateDetail } from "../../../api/client";
import { Button } from "../../ui/button";

interface PromptVersionHistoryTabProps {
  template: ApiPromptTemplateDetail;
  onEditVersion: (version: ApiPromptVersion) => void;
  onDuplicateVersion: (version: ApiPromptVersion) => void;
  onSetDefaultVersion?: (version: ApiPromptVersion) => void;
}

export function PromptVersionHistoryTab({ template, onEditVersion, onDuplicateVersion, onSetDefaultVersion }: PromptVersionHistoryTabProps) {
  if (!template.versions || template.versions.length === 0) {
    return (
      <div className="prompt-tab-placeholder">
        <p>暂无版本历史</p>
      </div>
    );
  }

  // 按版本号倒序排列（最新的在上面）
  const sortedVersions = [...template.versions].sort((a, b) => b.versionNo - a.versionNo);

  return (
    <div className="prompt-versions-container">
      <div className="prompt-versions-list">
        {sortedVersions.map((version) => {
          const isDefault = version.id === template.defaultVersionId;
          return (
            <div key={version.id} className={`prompt-version-item ${isDefault ? "is-default" : ""}`}>
              <div className="prompt-version-header">
                <div className="prompt-version-title">
                  <span className="prompt-version-number">v{version.versionNo}</span>
                  {isDefault && (
                    <span className="prompt-version-badge">
                      <CheckCircle2 size={12} />
                      默认版本
                    </span>
                  )}
                </div>
                <div className="prompt-version-actions">
                  {!isDefault && onSetDefaultVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetDefaultVersion(version)}
                      title="设为默认版本"
                    >
                      <Star size={13} />
                      设为默认
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditVersion(version)}
                    title="基于此版本编辑"
                  >
                    <Edit3 size={13} />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicateVersion(version)}
                    title="创建新版本"
                  >
                    <Copy size={13} />
                    复制
                  </Button>
                </div>
              </div>

              <div className="prompt-version-meta">
                <span className="prompt-version-date">
                  {new Date(version.createdAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span className="prompt-version-source">{version.source === 'marketplace' ? '商城' : '文件导入'}</span>
              </div>

              {version.changeNote && (
                <div className="prompt-version-note">
                  <label>修改说明：</label>
                  <p>{version.changeNote}</p>
                </div>
              )}

              <div className="prompt-version-content">
                <div className="prompt-version-field">
                  <label>System Prompt</label>
                  <pre>{version.body}</pre>
                </div>
                {version.userPromptTemplate && (
                  <div className="prompt-version-field">
                    <label>User Prompt Template</label>
                    <pre>{version.userPromptTemplate}</pre>
                  </div>
                )}
              </div>

              <div className="prompt-version-sync">
                <span className={`prompt-sync-status ${version.fileSyncStatus}`}>
                  文件同步: {version.fileSyncStatus === 'synced' ? '已同步' : version.fileSyncStatus === 'pending' ? '待同步' : '失败'}
                </span>
                {version.filePath && <span className="prompt-file-path">{version.filePath}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
