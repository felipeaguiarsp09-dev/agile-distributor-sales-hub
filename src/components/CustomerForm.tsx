import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL, type Role } from "@/lib/auth";

type Customer = Tables<"customers">;
export type CustomerValues = Pick<Customer, "name" | "cnpj_cpf" | "email" | "phone" | "notes" | "owner_id"> & {
  address: Record<string, string>;
};

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: CustomerValues;
  onSubmit: (v: CustomerValues) => Promise<void>;
  submitLabel: string;
}) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const sellers = useQuery({
    queryKey: ["profiles", "internal"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role").neq("role", "cliente").order("full_name");
      return data ?? [];
    },
  });
  const set = (k: keyof CustomerValues, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const setAddr = (k: string, val: string) => setV((p) => ({ ...p, address: { ...p.address, [k]: val } }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
      <Field label="Nome / razão social" className="sm:col-span-2">
        <Input required value={v.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="CNPJ/CPF"><Input value={v.cnpj_cpf ?? ""} onChange={(e) => set("cnpj_cpf", e.target.value || null)} /></Field>
      <Field label="Telefone"><Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} /></Field>
      <Field label="Email"><Input type="email" value={v.email ?? ""} onChange={(e) => set("email", e.target.value || null)} /></Field>
      <Field label="Vendedor responsável">
        <Select value={v.owner_id} onValueChange={(val) => set("owner_id", val)}>
          <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>
            {(sellers.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name} · {ROLE_LABEL[s.role as Role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Endereço" className="sm:col-span-2"><Input value={v.address["street"] ?? ""} onChange={(e) => setAddr("street", e.target.value)} /></Field>
      <Field label="Cidade"><Input value={v.address["city"] ?? ""} onChange={(e) => setAddr("city", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="UF"><Input maxLength={2} value={v.address["state"] ?? ""} onChange={(e) => setAddr("state", e.target.value.toUpperCase())} /></Field>
        <Field label="CEP"><Input value={v.address["zip"] ?? ""} onChange={(e) => setAddr("zip", e.target.value)} /></Field>
      </div>
      <Field label="Observações" className="sm:col-span-2">
        <Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="Informações para o cadastro no ERP" />
      </Field>
      <p className="text-xs text-muted-foreground sm:col-span-2">Limite e situação de crédito são definidos pelo ERP.</p>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}</Button>
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
