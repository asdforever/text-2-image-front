import { ALL_BATCHES, UNASSIGNED_BATCH, ALL_MODULES, UNASSIGNED_MODULE, type ImageBatch, type ImageModule } from "./image-batches";

export function ImageBatchFilter({ batches, value, onChange, label, includeUnassigned = true }: { batches: ImageBatch[]; value: string; onChange: (value: string) => void; label: string; includeUnassigned?: boolean }) {
  return <label className="image-batch-filter"><span>生成批次</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
    <option value={ALL_BATCHES}>全部批次</option>
    {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
    {value !== ALL_BATCHES && value !== UNASSIGNED_BATCH && !batches.some(batch => batch.id === value) && <option value={value}>所选批次暂无图片</option>}
    {includeUnassigned && <option value={UNASSIGNED_BATCH}>未分批次的图片</option>}
  </select></label>;
}

export function ImageModuleFilter({ modules, value, onChange, label, includeUnassigned = true }: { modules: ImageModule[]; value: string; onChange: (value: string) => void; label: string; includeUnassigned?: boolean }) {
  return <label className="image-batch-filter image-module-filter"><span>模块类型</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
    <option value={ALL_MODULES}>全部模块类型</option>
    {modules.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}
    {value !== ALL_MODULES && value !== UNASSIGNED_MODULE && !modules.some(module => module.id === value) && <option value={value}>所选模块暂无图片</option>}
    {includeUnassigned && <option value={UNASSIGNED_MODULE}>未记录模块类型</option>}
  </select></label>;
}
