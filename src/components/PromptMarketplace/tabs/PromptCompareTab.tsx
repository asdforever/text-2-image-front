import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Loader2, CheckCircle2, XCircle, History, Trash2 } from "lucide-react";
import type { ApiPromptTemplateDetail, ApiPromptVersion } from "../../../api/client";
import type { AssetLibrary, Asset, TestRun } from "../../../types/asset";
import { listAssetLibraries, listAssets, createTestRun, getTestRun } from "../../../lib/api-asset";
import { Button } from "../../ui/button";

interface PromptCompareTabProps {
  template: ApiPromptTemplateDetail;
}

interface ComparisonResult {
  version: ApiPromptVersion;
  testRun: TestRun | null;
  status: "pending" | "running" | "completed" | "failed";
}

interface ComparisonHistory {
  id: string;
  timestamp: string;
  inputType: "asset" | "text";
  inputAssetId?: string;
  inputAssetName?: string;
  inputText?: string;
  results: ComparisonResult[];
}

export function PromptCompareTab({ template }: PromptCompareTabProps) {
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"asset" | "text">("asset");
  const [assetLibraries, setAssetLibraries] = useState<AssetLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [comparisonHistory, setComparisonHistory] = useState<ComparisonHistory[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadAssetLibraries();
    loadHistoryFromStorage();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (selectedLibraryId) {
      void loadAssets(selectedLibraryId);
    } else {
      setAssets([]);
      setSelectedAssetId("");
    }
  }, [selectedLibraryId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadHistoryFromStorage = () => {
    const stored = localStorage.getItem(`comparison-history-${template.id}`);
    if (stored) {
      try { setComparisonHistory(JSON.parse(stored)); } catch { /* ignore */ }
    }
  };

  const saveHistoryToStorage = (history: ComparisonHistory[]) => {
    localStorage.setItem(`comparison-history-${template.id}`, JSON.stringify(history));
  };

  const loadAssetLibraries = async () => {
    try {
      const data = await listAssetLibraries();
      setAssetLibraries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材库失败");
    }
  };

  const loadAssets = async (libraryId: string) => {
    try {
      const data = await listAssets(libraryId);
      setAssets(data);
      if (data.length > 0) setSelectedAssetId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材失败");
    }
  };

  const handleVersionToggle = (versionId: string) => {
    setSelectedVersionIds(prev =>
      prev.includes(versionId) ? prev.filter(id => id !== versionId) : [...prev, versionId]
    );
  };

  const handleCompare = async () => {
    if (selectedVersionIds.length === 0) { setError("请至少选择一个版本"); return; }
    if (inputType === "asset" && !selectedAssetId) { setError("请选择一个素材"); return; }
    if (inputType === "text" && !inputText.trim()) { setError("请输入测试文本"); return; }

    setError("");
    setRunning(true);
    stopPolling();

    const selectedVersions = template.versions.filter(v => selectedVersionIds.includes(v.id));
    const initialResults: ComparisonResult[] = selectedVersions.map(v => ({
      version: v, testRun: null, status: "pending" as const,
    }));
    setComparisonResults(initialResults);

    // Create all test runs
    const runIds: (string | null)[] = [];
    for (let i = 0; i < selectedVersions.length; i++) {
      try {
        const testRun = await createTestRun({
          promptVersionId: selectedVersions[i].id,
          inputAssetId: inputType === "asset" ? selectedAssetId : undefined,
          inputText: inputType === "text" ? inputText : undefined,
        });
        runIds.push(testRun.id);
        setComparisonResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, testRun, status: testRun.status as ComparisonResult["status"] } : r
        ));
      } catch {
        runIds.push(null);
        setComparisonResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: "failed" as const } : r
        ));
      }
    }
    // Poll all active runs
    const activeIds = runIds.filter((id): id is string => id !== null);
    if (activeIds.length > 0) {
      pollRef.current = setInterval(async () => {
        let allDone = true;
        for (let i = 0; i < selectedVersions.length; i++) {
          const runId = runIds[i];
          if (!runId) continue;
          try {
            const updated = await getTestRun(runId);
            setComparisonResults(prev => prev.map((r, idx) =>
              idx === i ? { ...r, testRun: updated, status: updated.status as ComparisonResult["status"] } : r
            ));
            if (updated.status !== "completed" && updated.status !== "failed") {
              allDone = false;
            }
          } catch {
            // keep polling on transient errors
            allDone = false;
          }
        }
        if (allDone) {
          stopPolling();
          setRunning(false);
          // Save to history
          setComparisonResults(prev => {
            const selectedAsset = assets.find(a => a.id === selectedAssetId);
            const newHistory: ComparisonHistory = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              inputType,
              inputAssetId: inputType === "asset" ? selectedAssetId : undefined,
              inputAssetName: inputType === "asset" ? selectedAsset?.name : undefined,
              inputText: inputType === "text" ? inputText : undefined,
              results: prev,
            };
            const updatedHistory = [newHistory, ...comparisonHistory].slice(0, 10);
            setComparisonHistory(updatedHistory);
            saveHistoryToStorage(updatedHistory);
            return prev;
          });
        }
      }, 2000);
    } else {
      setRunning(false);
    }
  };

  const handleDeleteHistory = (historyId: string) => {
    const updatedHistory = comparisonHistory.filter(h => h.id !== historyId);
    setComparisonHistory(updatedHistory);
    saveHistoryToStorage(updatedHistory);
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const sortedVersions = [...template.versions].sort((a, b) => b.versionNo - a.versionNo);

  return (
    <div className="prompt-compare-tab">
      <div className="prompt-compare-config">
        <div className="prompt-compare-section">
          <label>选择要对比的版本（最多 4 个）</label>
          <div className="prompt-version-selector">
            {sortedVersions.map(version => (
              <button
                key={version.id}
                className={`prompt-version-option ${selectedVersionIds.includes(version.id) ? "selected" : ""}`}
                onClick={() => handleVersionToggle(version.id)}
                disabled={!selectedVersionIds.includes(version.id) && selectedVersionIds.length >= 4}
              >
                <input type="checkbox" checked={selectedVersionIds.includes(version.id)} onChange={() => {}}
                  disabled={!selectedVersionIds.includes(version.id) && selectedVersionIds.length >= 4} />
                <div className="prompt-version-info">
                  <span className="prompt-version-label">v{version.versionNo}</span>
                  {version.id === template.defaultVersionId && (
                    <span className="prompt-version-default-badge">默认</span>
                  )}
                </div>
                <span className="prompt-version-date">{new Date(version.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
          <p className="prompt-compare-hint">已选择 {selectedVersionIds.length} 个版本</p>
        </div>

        <div className="prompt-compare-section">
          <label>输入类型</label>
          <div className="prompt-test-input-type">
            <button className={`prompt-input-type-btn ${inputType === "asset" ? "active" : ""}`}
              onClick={() => setInputType("asset")}>素材输入</button>
            <button className={`prompt-input-type-btn ${inputType === "text" ? "active" : ""}`}
              onClick={() => setInputType("text")}>文本输入</button>
          </div>
        </div>
        {inputType === "asset" ? (
          <>
            <div className="prompt-compare-section">
              <label>选择素材库</label>
              {assetLibraries.length === 0 ? (
                <p className="prompt-test-empty">暂无可用的素材库</p>
              ) : (
                <select className="prompt-test-select" value={selectedLibraryId}
                  onChange={(e) => setSelectedLibraryId(e.target.value)}>
                  <option value="">请选择素材库</option>
                  {assetLibraries.map(lib => (
                    <option key={lib.id} value={lib.id}>{lib.name} ({lib.assetType})</option>
                  ))}
                </select>
              )}
            </div>
            {selectedLibraryId && assets.length > 0 && (
              <div className="prompt-compare-section">
                <label>选择素材</label>
                <select className="prompt-test-select" value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedAsset && selectedAsset.assetType === "image" && selectedAsset.url && (
              <div className="prompt-test-preview">
                <label>素材预览</label>
                <img src={selectedAsset.url} alt={selectedAsset.name} />
              </div>
            )}
          </>
        ) : (
          <div className="prompt-compare-section">
            <label>输入文本</label>
            <textarea className="prompt-test-textarea" value={inputText}
              onChange={(e) => setInputText(e.target.value)} rows={4} placeholder="输入测试文本内容..." />
          </div>
        )}

        <div className="prompt-test-actions">
          <Button onClick={handleCompare} disabled={running || selectedVersionIds.length === 0}>
            {running ? (<><Loader2 size={13} className="spinning" /> 对比中...</>)
              : (<><Play size={13} /> 开始对比</>)}
          </Button>
        </div>

        {error && (<div className="prompt-test-error"><XCircle size={14} />{error}</div>)}
      </div>
      {comparisonResults.length > 0 && (
        <div className="prompt-compare-results">
          <h4>当前对比结果</h4>
          <div className="prompt-compare-grid">
            {comparisonResults.map((result) => (
              <div key={result.version.id} className="prompt-compare-result-card">
                <div className="prompt-compare-card-header">
                  <span className="prompt-version-number">v{result.version.versionNo}</span>
                  <span className={`prompt-test-status ${result.status}`}>
                    {result.status === "completed" && <CheckCircle2 size={12} />}
                    {(result.status === "running" || result.status === "pending") && <Loader2 size={12} className="spinning" />}
                    {result.status === "failed" && <XCircle size={12} />}
                    {result.status === "completed" ? "完成" : result.status === "running" ? "运行中" : result.status === "failed" ? "失败" : "等待中"}
                  </span>
                </div>
                <div className="prompt-compare-prompt">
                  <label>提示词</label>
                  <pre>{result.version.body.substring(0, 150)}{result.version.body.length > 150 ? "..." : ""}</pre>
                </div>
                {result.testRun && result.status === "completed" && (
                  <>
                    <div className="prompt-compare-output">
                      <label>输出结果</label>
                      {result.testRun.outputText && <pre>{result.testRun.outputText}</pre>}
                      {result.testRun.outputProduct && result.testRun.outputProduct.url && (
                        <img src={result.testRun.outputProduct.url} alt="输出结果" />
                      )}
                    </div>
                    {result.testRun.durationMs && (
                      <div className="prompt-compare-metrics">
                        <span className="prompt-metric-item"><strong>耗时:</strong> {(result.testRun.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </>
                )}
                {(result.status === "running" || result.status === "pending") && (
                  <div className="prompt-compare-pending"><Loader2 size={16} className="spinning" /> 生成中...</div>
                )}
                {result.status === "failed" && (
                  <div className="prompt-compare-error"><XCircle size={14} />{result.testRun?.errorMessage || "测试失败"}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {comparisonHistory.length > 0 && (
        <div className="prompt-compare-history">
          <div className="prompt-compare-history-header">
            <button className="prompt-history-toggle" onClick={() => setShowHistory(!showHistory)}>
              <History size={14} /> 历史对比记录 ({comparisonHistory.length}) {showHistory ? " ▼" : " ▶"}
            </button>
          </div>
          {showHistory && (
            <div className="prompt-history-list">
              {comparisonHistory.map((history) => (
                <div key={history.id} className="prompt-history-item">
                  <div className="prompt-history-item-header">
                    <span className="prompt-history-time">{new Date(history.timestamp).toLocaleString("zh-CN")}</span>
                    <div className="prompt-history-actions">
                      <span className="prompt-history-input">
                        {history.inputType === "asset" ? `素材: ${history.inputAssetName}` : `文本: ${history.inputText?.substring(0, 20)}...`}
                      </span>
                      <button className="prompt-history-delete" onClick={() => handleDeleteHistory(history.id)} title="删除">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="prompt-compare-grid">
                    {history.results.map((result) => (
                      <div key={result.version.id} className="prompt-compare-result-card prompt-history-result">
                        <div className="prompt-compare-card-header">
                          <span className="prompt-version-number">v{result.version.versionNo}</span>
                          <span className={`prompt-test-status ${result.status}`}>
                            {result.status === "completed" && <CheckCircle2 size={12} />}
                            {result.status === "failed" && <XCircle size={12} />}
                            {result.status === "completed" ? "完成" : "失败"}
                          </span>
                        </div>
                        {result.testRun && result.status === "completed" && (
                          <>
                            {result.testRun.outputText && (
                              <pre className="prompt-history-output">{result.testRun.outputText.substring(0, 100)}...</pre>
                            )}
                            {result.testRun.outputProduct && result.testRun.outputProduct.url && (
                              <img src={result.testRun.outputProduct.url} alt="输出结果" className="prompt-history-image" />
                            )}
                            {result.testRun.durationMs && (
                              <span className="prompt-history-metric">{(result.testRun.durationMs / 1000).toFixed(1)}s</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
