import React from "react";
import { useGenerationConfigStore } from "../../store/useGenerationConfigStore";

export interface OutputSettingsValue {
  outputLanguage: string;
  model: string;
  aspectRatio: string;
  resolution: string;
}

export function OutputSettings({ value, onChange }: { value: OutputSettingsValue; onChange: (value: OutputSettingsValue) => void }) {
  const patch = (next: Partial<OutputSettingsValue>) => onChange({ ...value, ...next });
  const standardLanguages = ["中文", "英文", "日文"];
  const languages = standardLanguages.includes(value.outputLanguage) ? standardLanguages : [value.outputLanguage, ...standardLanguages];
  const models = useGenerationConfigStore((state) => (state.runtimePublished ?? state.published).models);
  const matchedModel = models.find((model) => model.id === value.model || model.label === value.model);
  const selectedModel = matchedModel ?? (!value.model ? models[0] : undefined);
  const modelIsMissing = Boolean(value.model) && !matchedModel;
  const resolutions = selectedModel?.resolutions?.length ? selectedModel.resolutions : [value.resolution].filter(Boolean);
  return (
    <div className="output-settings-grid">
      <label className="wide">输出语言
        <select value={value.outputLanguage} onChange={(event) => patch({ outputLanguage: event.target.value })}>
          {languages.map((language) => <option key={language}>{language}</option>)}
        </select>
      </label>
      <label>模型
        <select value={selectedModel?.id ?? value.model} onChange={(event) => { const model = models.find((item) => item.id === event.target.value); patch({ model: model?.id ?? event.target.value, resolution: model?.resolutions.includes(value.resolution) ? value.resolution : model?.resolutions[0] ?? value.resolution }); }}>
          {modelIsMissing && <option value={value.model}>{value.model}（已失效）</option>}
          {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </label>
      <label>宽高比
        <select value={value.aspectRatio} onChange={(event) => patch({ aspectRatio: event.target.value })}>
          <option>1:1</option><option>3:4</option><option>4:3</option><option>16:9</option>
        </select>
      </label>
      <label className="wide">分辨率
        <select value={value.resolution} onChange={(event) => patch({ resolution: event.target.value })}>
          {resolutions.map((resolution) => <option key={resolution}>{resolution}</option>)}
        </select>
        {selectedModel && <small>当前模型支持：{resolutions.join("、")}</small>}
      </label>
    </div>
  );
}
