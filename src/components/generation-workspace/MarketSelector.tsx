import React from "react";
import { findGenerationMarket, groupGenerationMarkets, type GenerationMarketScope } from "../../lib/generation-config";
import type { GenerationMarket } from "../../lib/generation-workspace";
import { useGenerationConfigStore } from "../../store/useGenerationConfigStore";

export function MarketSelector({ value, onChange }: { value: GenerationMarket; onChange: (value: GenerationMarket) => void }) {
  const markets = useGenerationConfigStore((state) => state.published.markets);
  const selected = findGenerationMarket(markets, value);
  const groups = groupGenerationMarkets(markets);
  return (
    <div className="market-selector" role="group" aria-label="电商市场">
      <div className="studio-market-fields">{(["domestic", "overseas"] as const).map((scope: GenerationMarketScope) => <label className="studio-market-field" key={scope}>
        <span>{scope === "domestic" ? "国内" : "国外"}</span>
        <select aria-label={scope === "domestic" ? "国内电商平台" : "国外电商平台"} value={selected?.marketScope === scope ? selected.id : ""} onChange={(event) => onChange(event.target.value)}>
          <option value="" disabled>选择平台</option>
          {groups[scope].map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}
        </select>
      </label>)}</div>
      {!selected && value && <div className="market-guidance" role="alert"><strong>当前市场已失效</strong><span>请前往生成配置重新选择有效市场。</span></div>}
      {selected && <div className="market-guidance" role="status">
        <details><summary>{selected.label} · {selected.defaultLanguage}</summary><p>{selected.guidance}</p></details>
      </div>}
    </div>
  );
}
