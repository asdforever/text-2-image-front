import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Play, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { ApiPromptTemplateDetail } from "../../../api/client";
import type { AssetLibrary, Asset, TestRun } from "../../../types/asset";
import { listAssetLibraries, listAssets, createTestRun, getTestRun } from "../../../lib/api-asset";
import { Button } from "../../ui/button";

interface PromptTestTabProps {
  template: ApiPromptTemplateDetail;
}

export function PromptTestTab({ template }: PromptTestTabProps) {
  const navigate = useNavigate();
  const [inputType, setInputType] = useState<"asset" | "text">("asset");
  const [assetLibraries, setAssetLibraries] = useState<AssetLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generation parameters state
  const [generationParams, setGenerationParams] = useState({
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
    seed: undefined as number | undefined,
  });

  useEffect(() => {
    void loadAssetLibraries();
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

  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const updated = await getTestRun(runId);
        setTestRun(updated);
        if (updated.status === "completed" || updated.status === "failed") {
          stopPolling();
          setRunning(false);
        }
      } catch {
        stopPolling();
        setRunning(false);
      }
    }, 2000);
  }, [stopPolling]);

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
      if (data.length > 0) {
        setSelectedAssetId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材失败");
    }
  };

  const handleRunTest = async () => {
    if (!template.defaultVersion) {
      setError("没有默认版本");
      return;
    }
    if (inputType === "asset" && !selectedAssetId) {
      setError("请选择一个素材");
      return;
    }
    if (inputType === "text" && !inputText.trim()) {
      setError("请输入测试文本");
      return;
    }

    setError("");
    setRunning(true);
    setTestRun(null);

    try {
      const result = await createTestRun({
        promptVersionId: template.defaultVersion.id,
        inputAssetId: inputType === "asset" ? selectedAssetId : undefined,
        inputText: inputType === "text" ? inputText : undefined,
        generationParams: template.executionTarget === "image_model" ? {
          size: generationParams.size,
          quality: generationParams.quality,
          style: generationParams.style,
          seed: generationParams.seed,
        } : undefined,
      });
      setTestRun(result);
      // Start polling if status is not terminal
      if (result.status !== "completed" && result.status !== "failed") {
        startPolling(result.id);
      } else {
        setRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试运行失败");
      setRunning(false);
    }
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  if (!template.defaultVersion) {
    return (
      <div className="prompt-tab-placeholder">
        <p>没有默认版本，无法进行测试</p>
      </div>
    );
  }

  if (["style-seed", "style-planner", "planner", "hero-module-planner", "suite-module-planner"].includes(String(template.defaultVersion.applicability?.runtimeRole))) {
    return <div className="prompt-tab-placeholder"><p>这是风格或规划模板。请在主图或详情页工作台选择对应风格或模块，结合商品图片生成方案后查看效果。</p><p>此处的直接生图测试仅适用于生图提示词。</p></div>;
  }

  return (
    <div className="prompt-test-tab">
      <div className="prompt-test-config">
        <div className="prompt-test-section">
          <label>输入类型</label>
          <div className="prompt-test-input-type">
            <button
              className={`prompt-input-type-btn ${inputType === "asset" ? "active" : ""}`}
              onClick={() => setInputType("asset")}
            >
              素材输入
            </button>
            <button
              className={`prompt-input-type-btn ${inputType === "text" ? "active" : ""}`}
              onClick={() => setInputType("text")}
            >
              文本输入
            </button>
          </div>
        </div>

        {inputType === "asset" ? (
          <>
            <div className="prompt-test-section">
              <label>选择素材库</label>
              {assetLibraries.length === 0 ? (
                <p className="prompt-test-empty">暂无可用的素材库</p>
              ) : (
                <select
                  className="prompt-test-select"
                  value={selectedLibraryId}
                  onChange={(e) => setSelectedLibraryId(e.target.value)}
                >
                  <option value="">请选择素材库</option>
                  {assetLibraries.map(lib => (
                    <option key={lib.id} value={lib.id}>
                      {lib.name} ({lib.assetType})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedLibraryId && (
              <div className="prompt-test-section">
                <label>选择素材</label>
                {assets.length === 0 ? (
                  <p className="prompt-test-empty">该素材库中暂无素材</p>
                ) : (
                  <div className="prompt-asset-grid">
                    {assets.map(asset => (
                      <button
                        key={asset.id}
                        className={`prompt-asset-item ${selectedAssetId === asset.id ? "selected" : ""}`}
                        onClick={() => setSelectedAssetId(asset.id)}
                      >
                        {asset.assetType === "image" && asset.url ? (
                          <img src={asset.url} alt={asset.name} />
                        ) : (
                          <div className="prompt-asset-placeholder">
                            {asset.assetType === "text" ? "T" : "?"}
                          </div>
                        )}
                        <span className="prompt-asset-name">{asset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedAsset && selectedAsset.assetType === "image" && selectedAsset.url && (
              <div className="prompt-test-preview">
                <label>预览</label>
                <img src={selectedAsset.url} alt={selectedAsset.name} />
              </div>
            )}

            {selectedAsset && selectedAsset.assetType === "text" && selectedAsset.content && (
              <div className="prompt-test-preview">
                <label>预览</label>
                <pre>{selectedAsset.content}</pre>
              </div>
            )}
          </>
        ) : (
          <div className="prompt-test-section">
            <label>输入文本</label>
            <textarea
              className="prompt-test-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
              placeholder="输入测试文本内容..."
            />
          </div>
        )}
        <div className="prompt-test-actions">
          <Button onClick={handleRunTest} disabled={running}>
            {running ? (
              <>
                <Loader2 size={13} className="spinning" />
                运行中...
              </>
            ) : (
              <>
                <Play size={13} />
                运行测试
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="prompt-test-error">
            <XCircle size={14} />
            {error}
          </div>
        )}
      </div>

      {testRun && (
        <div className="prompt-test-result">
          <div className="prompt-test-result-header">
            <h4>测试结果</h4>
            <span className={`prompt-test-status ${testRun.status}`}>
              {testRun.status === "completed" && <CheckCircle2 size={14} />}
              {(testRun.status === "running" || testRun.status === "pending") && <Loader2 size={14} className="spinning" />}
              {testRun.status === "failed" && <XCircle size={14} />}
              {testRun.status === "completed" ? "完成" : testRun.status === "running" ? "运行中" : testRun.status === "failed" ? "失败" : "等待中"}
            </span>
          </div>

          {testRun.status === "completed" && (
            <>
              <div className="prompt-test-output">
                <label>输出</label>
                {testRun.outputText && <pre>{testRun.outputText}</pre>}
                {testRun.outputProduct && testRun.outputProduct.url && (
                  <img src={testRun.outputProduct.url} alt="输出结果" />
                )}
              </div>

              {testRun.durationMs && (
                <div className="prompt-test-metrics">
                  <span>耗时: {(testRun.durationMs / 1000).toFixed(1)}s</span>
                </div>
              )}

              {testRun.outputProductId && (
                <div className="prompt-test-save">
                  <span><CheckCircle2 size={14} />已自动保存到测试库</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void navigate({ to: "/test-product-libraries" })}
                  >
                    <ExternalLink size={13} />
                    打开测试库
                  </Button>
                </div>
              )}
            </>
          )}

          {(testRun.status === "running" || testRun.status === "pending") && (
            <div className="prompt-test-running">
              <Loader2 size={24} className="spinning" />
              <p>正在调用大模型生成中，请稍候...</p>
            </div>
          )}

          {testRun.status === "failed" && testRun.errorMessage && (
            <div className="prompt-test-error">
              <XCircle size={14} />
              {testRun.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
