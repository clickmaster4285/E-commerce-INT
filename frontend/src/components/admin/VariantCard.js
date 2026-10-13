"use client";
import { Plus, Trash2, Copy, ChevronDown, AlertTriangle, Upload, X, Image as ImageIcon, Tag as TagIcon, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";

const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        {label} {required && <span style={{ color: "var(--danger-text)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function VariantCard({
  variant = {},
  index,
  expanded,
  onToggle,
  onRemove,
  onDuplicate,
  onUpdate,
  onAddImage,
  onRemoveImage,
  onAddTag,
  onRemoveTag,
  onUpdateTagInput,
  variantAttributesTree = [],
  rawAttributes = [],
  isEditingProduct = false,
  readOnlySku = false,
  // PO-specific fields
  poMode = false,
  onUpdatePoField,
  stockInfo = null,
  included = true,
  onIncludedChange,
}) {
  // Ensure variant has all required fields with defaults
  const v = {
    sku: "",
    title: "",
    description: "",
    cost_price: "",
    selling_price: "",
    quantity: "0",
    min_qnt: "0",
    max_qnt: "0",
    topup: "0",
    attributes: [],
    images: [],
    tags: [],
    tagInput: "",
    tax_rate: "0",
    batch_no: "",
    mfg_date: "",
    expiry_date: "",
    ...variant,
  };
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []).filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (files.length !== (event.target.files?.length || 0)) { toast.error("Only JPG, PNG and WebP allowed"); return; }
    const newPreviews = files.map(f => ({ file: f, preview: URL.createObjectURL(f), existing: false }));
    onAddImage(newPreviews);
    event.target.value = "";
  };

  const handleRemoveImage = (fi) => {
    onRemoveImage(fi);
  };

  return (
    <div className="overflow-hidden rounded-xl" style={cardStyle}>
      <div className="flex cursor-pointer items-center justify-between px-4 py-3"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
        onClick={() => onToggle()}>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {poMode && onIncludedChange && (
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => { e.stopPropagation(); onIncludedChange(e.target.checked); }}
              className="w-4 h-4 rounded cursor-pointer shrink-0" style={{ accentColor: "var(--accent)" }}
            />
          )}
          <div>
            <p className="text-[13px] font-bold truncate">{v.sku || `Variant ${index + 1}`}</p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{v.title || `Variant #${index + 1}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!poMode && (
            <>
              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
                <CopyIcon className="w-4 h-4" />
              </button>
              <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "var(--danger)" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 p-4 border-t" style={{ borderColor: "var(--border-color)" }}>
          {/* Stock info (PO mode) */}
          {poMode && stockInfo && (
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Stock: </span>
              <span className="font-mono text-[13px]">{stockInfo.in_stock}</span>
              {stockInfo.min_qnt && (
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Min: {stockInfo.min_qnt}</span>
              )}
            </div>
          )}

          {/* Identification */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Identification</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="SKU" required>
                <input
                  required type="text" placeholder="e.g. sku_4" value={v.sku}
                  readOnly={readOnlySku}
                  onChange={(e) => onUpdate("sku", e.target.value)}
                  className={`h-9 px-3 rounded-lg text-[12px] w-full outline-none ${readOnlySku ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={inputStyle} />
              </Field>
              <Field label="Variant Title" required>
                <input required type="text" placeholder="e.g. Black - Large" value={v.title}
                  onChange={(e) => onUpdate("title", e.target.value)}
                  className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={inputStyle} />
              </Field>
            </div>
            <Field label="Variant Description" className="mt-2">
              <textarea rows={2} placeholder="Enter variant description..." value={v.description}
                onChange={(e) => onUpdate("description", e.target.value)}
                className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={inputStyle} />
            </Field>
          </div>

          {/* Pricing & Stock */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Pricing & Stock</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { l: "Cost Price", f: "cost_price", p: "1000", required: true },
                { l: "Selling Price", f: "selling_price", p: "1500", required: true },
                { l: "Topup", f: "topup", p: "0", required: false },
                { l: "Quantity", f: "quantity", p: "50", required: false, step: "1", integer: true },
                { l: "Min Qty", f: "min_qnt", p: "0", required: false, step: "1", integer: true },
                { l: "Max Qty", f: "max_qnt", p: "0", required: false, step: "1", integer: true },
              ].map(({ l, f, p, required, step = "0.01", integer }) => (
                <Field key={f} label={l} required={required}>
                  <input
                    type="number" min="0" step={step} inputMode={integer ? "numeric" : "decimal"} placeholder={p} value={variant[f]}
                    onKeyDown={(e) => { if (integer && [".", ",", "-", "+", "e", "E"].includes(e.key)) e.preventDefault(); }}
                    onChange={(e) => {
                      const val = integer
                        ? ((e.target.value.includes(".") ? e.target.value.slice(0, e.target.value.indexOf(".")) : e.target.value).replace(/[^0-9]/g, ""))
                        : e.target.value;
                      if (poMode && onUpdatePoField) onUpdatePoField(f, val);
                      else onUpdate(f, val);
                    }}
                    className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={inputStyle} />
                </Field>
              ))}
            </div>
            {v.cost_price !== "" && v.selling_price !== "" && Number(v.selling_price) <= Number(v.cost_price) && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3"
                style={{ borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)", backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--danger)" }} />
                <p className="text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Selling Price must be greater than Cost Price</p>
              </div>
            )}
          </div>

          {/* PO-specific fields */}
          {poMode && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>PO Details</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { l: "Tax %", f: "tax_rate", p: "0", step: "0.01" },
                  { l: "Batch No.", f: "batch_no", p: "—", type: "text" },
                  { l: "MFG Date", f: "mfg_date", p: "", type: "date" },
                  { l: "Expiry Date", f: "expiry_date", p: "", type: "date" },
                ].map(({ l, f, p, step, type }) => (
                  <Field key={f} label={l}>
                    <input
                      type={type || "number"} min={type === "number" ? "0" : undefined} max={f === "tax_rate" ? "100" : undefined} step={step}
                      placeholder={p} value={variant[f] || ""}
                      onChange={(e) => onUpdatePoField && onUpdatePoField(f, e.target.value)}
                      className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={inputStyle} />
                  </Field>
                ))}
              </div>
            </div>
          )}

          {/* Variant Tags (non-PO mode) */}
          {!poMode && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Variant Tags</p>
              <div className="flex gap-2 mb-3">
                <input type="text" value={v.tagInput || ""} onChange={(e) => onUpdateTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddTag(e)} placeholder="Add specific tag for this v..."
                  className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none" style={inputStyle} />
                <button type="button" onClick={onAddTag} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {v.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {v.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      {tag}
                      <button type="button" onClick={() => onRemoveTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attributes (from category) */}
          {(variantAttributesTree?.length > 0) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
              <div className="space-y-2">
                {variantAttributesTree.map((main) => (
                  <div key={main._id} className="grid grid-cols-2 gap-2">
                    {(main.sub_attributes?.length ? main.sub_attributes : [main]).map((attr) => {
                      const key = main.sub_attributes?.length ? main.name : main.name;
                      const current = v.attributes?.[key]?.[attr.name] || "";
                      const opts = (attr.values || []).map((v) => typeof v === "object" ? (v.label || v.value) : v);
                      return (
                        <Field key={attr._id} label={attr.name}>
                          <select
                            value={current}
                            onChange={(e) => onUpdate(`attributes.${key}.${attr.name}`, e.target.value)}
                            className="w-full h-9 rounded-lg px-2 text-[12px] outline-none" style={inputStyle}
                          >
                            <option value="">Select {attr.name}</option>
                            {opts.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </Field>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Attributes (non-PO mode, from rawAttributes) */}
          {!poMode && rawAttributes?.length > 0 && v.attributes?.some(a => 
            !variantAttributesTree?.some(m => 
              (m.sub_attributes?.some(sa => m.name + "." + sa.name === a.name)) ||
              (!m.sub_attributes?.length && m.name === a.name)
            )
          ) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Custom Attributes</p>
              <div className="space-y-2">
                {v.attributes.map((attr, ai) => {
                  const preset = rawAttributes.find(p => p.name === attr.name);
                  const isMulti = preset?.data_type === "multi_select";
                  const isNumber = preset?.data_type === "number";
                  const selectedSingle = typeof attr.value === "string" ? attr.value : "";
                  
                  return (
                    <div key={ai} className="flex flex-wrap items-center gap-2">
                      <div className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 flex items-center gap-2 font-semibold truncate"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                        <span className="truncate">{attr.name || "—"}</span>
                      </div>
                      {preset && isMulti ? (
                        <div className="flex-1 min-w-[180px] flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg min-h-[42px]"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          {!selectedSingle && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Select an option...</span>}
                          {selectedSingle && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                              style={{ backgroundColor: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                              {selectedSingle}
                              <button type="button" onClick={() => onUpdate(`attributes.${ai}.value`, "")} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                            {preset.values.filter((val) => val !== selectedSingle).map((val) => (
                              <button key={val} type="button" onClick={() => onUpdate(`attributes.${ai}.value`, val)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                                style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : preset ? (
                        <input type={isNumber ? "number" : "text"} value={attr.value || ""} onChange={(e) => onUpdate(`attributes.${ai}.value`, e.target.value)}
                          placeholder={`Enter ${preset.name.toLowerCase()} value...`}
                          className="h-9 px-3 rounded-lg text-[12px] flex-1 min-w-[180px] outline-none" style={inputStyle} />
                      ) : (
                        <div className="flex gap-2 flex-1 min-w-[180px]">
                          <input value={attr.name} onChange={(e) => onUpdate(`attributes.${ai}.name`, e.target.value)}
                            className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none" style={inputStyle} placeholder="Attribute name" />
                          <input value={attr.value} onChange={(e) => onUpdate(`attributes.${ai}.value`, e.target.value)}
                            className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none" style={inputStyle} placeholder="Value" />
                          <button type="button" onClick={() => onUpdate("attributes", v.attributes.filter((_, i) => i !== ai))}
                            className="h-9 px-3 rounded-lg self-end transition hover:opacity-70" style={{ color: "var(--danger)" }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Images */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Images</p>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              className="h-9 w-full text-[12px] mb-2" style={inputStyle} />
            <div className="flex items-center gap-2 flex-wrap">
              {(v.images || []).map((image, fi) => (
                <div key={`${image.file?.name || image.img_url}-${fi}`} className="relative">
                  <img src={image.preview || image.img_url} alt={image.file?.name || "variant"} className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: "var(--border-color)" }} />
                  <button type="button" onClick={() => { if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview); handleRemoveImage(fi); }}
                    className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X size={12} /></button>
                </div>
              ))}
              <span className="text-[11px] self-center" style={{ color: "var(--text-muted)" }}>{v.images?.length ? `${v.images.length} image(s)` : "No images"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
