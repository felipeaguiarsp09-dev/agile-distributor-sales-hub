import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type ProductValues = Pick<
  Tables<"products">,
  "sku" | "name" | "description" | "category" | "unit_price" | "stock_quantity" | "is_ecommerce_visible" | "is_active" | "image_url"
>;

export function ProductForm({ initial, onSubmit, submitLabel }: { initial: ProductValues; onSubmit: (v: ProductValues) => Promise<void>; submitLabel: string }) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ProductValues, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(v); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
      <F label="Nome" className="sm:col-span-2"><Input required value={v.name} onChange={(e) => set("name", e.target.value)} /></F>
      <F label="SKU"><Input required value={v.sku} onChange={(e) => set("sku", e.target.value)} /></F>
      <F label="Categoria"><Input value={v.category ?? ""} onChange={(e) => set("category", e.target.value || null)} /></F>
      <F label="Descrição" className="sm:col-span-2"><Textarea value={v.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></F>
      <F label="Preço (R$)"><Input type="number" min={0} step="0.01" value={v.unit_price} onChange={(e) => set("unit_price", Number(e.target.value))} /></F>
      <F label="Estoque (espelho do ERP)"><Input type="number" value={v.stock_quantity} readOnly disabled title="O estoque é atualizado somente pelo ERP" /></F>
      <F label="Endereço da imagem" className="sm:col-span-2"><Input type="url" placeholder="https://" value={v.image_url ?? ""} onChange={(e) => set("image_url", e.target.value || null)} /></F>
      <label className="flex items-center gap-3 text-sm"><Switch checked={v.is_ecommerce_visible} onCheckedChange={(c) => set("is_ecommerce_visible", c)} /> Visível no E-commerce</label>
      <label className="flex items-center gap-3 text-sm"><Switch checked={v.is_active} onCheckedChange={(c) => set("is_active", c)} /> Produto ativo</label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}</Button>
      </div>
    </form>
  );
}

function F({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}
