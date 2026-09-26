import React, { useEffect, useState } from "react";
import { CUSTOM_STYLE_ID, type StyleCategory } from "../../lib/generation-workspace";

export function StyleLibrary(props: {
  categories: StyleCategory[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  customStyle?: string;
  onCustomStyleChange?: (value: string) => void;
}) {
  const styles = props.categories.flatMap((category) => category.styles);
  const [categoryId, setCategoryId] = useState(() => props.categories.find((category) => category.styles.some((style) => style.id === props.selectedId))?.id ?? props.categories[0]?.id ?? "");
  const category = props.categories.find((item) => item.id === categoryId) ?? props.categories[0];
  const selected = styles.find((style) => style.id === props.selectedId);
  useEffect(() => {
    const selectedCategory = props.categories.find((item) => item.styles.some((style) => style.id === props.selectedId));
    if (selectedCategory) setCategoryId(selectedCategory.id);
  }, [props.selectedId, props.categories]);
  const chooseNext = () => {
    if (styles.length === 0) return;
    const current = styles.findIndex((style) => style.id === props.selectedId);
    const next = styles[(current + 1 + styles.length) % styles.length];
    props.onChange(next.id);
    setCategoryId(props.categories.find((item) => item.styles.some((style) => style.id === next.id))?.id ?? "");
  };
  return (
    <div className="style-library">
      <div className="studio-style-tools">
        <button type="button" className={`studio-custom-toggle${props.selectedId === CUSTOM_STYLE_ID ? " selected" : ""}`} aria-pressed={props.selectedId === CUSTOM_STYLE_ID} onClick={() => props.onChange(props.selectedId === CUSTOM_STYLE_ID ? null : CUSTOM_STYLE_ID)}>＋ 自定义</button>
        <select aria-label="风格分类" value={category?.id ?? ""} onChange={(event) => setCategoryId(event.target.value)}>{props.categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </div>
      <div className="style-custom-row">
        {props.selectedId === CUSTOM_STYLE_ID && (
          <label className="style-custom-editor">
            <span>自定义风格描述</span>
            <textarea
              value={props.customStyle ?? ""}
              maxLength={300}
              placeholder="描述你希望的图片风格…"
              onChange={(event) => props.onCustomStyleChange?.(event.target.value)}
            />
            <small>{(props.customStyle ?? "").length}/300</small>
          </label>
        )}
      </div>
      {category && (
        <div className="style-category">
          <div className="style-card-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, category.styles.length))}, minmax(0, 1fr))` }}>
            {category.styles.map((style) => (
              <button
                key={style.id}
                type="button"
                aria-pressed={props.selectedId === style.id}
                className={props.selectedId === style.id ? "selected" : ""}
                title={style.description}
                onClick={() => props.onChange(props.selectedId === style.id ? null : style.id)}
              >
                <i className="studio-style-swatch" data-style={style.id} data-category={category.id} aria-hidden="true"><i /></i>
                <strong>{style.label}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="studio-style-selection"><span>{selected ? `${selected.label} · ${selected.description}` : props.selectedId === CUSTOM_STYLE_ID ? "使用自定义风格描述" : "选择一种视觉风格"}</span><button type="button" onClick={chooseNext} title="切换推荐风格">换一个</button></div>
    </div>
  );
}
