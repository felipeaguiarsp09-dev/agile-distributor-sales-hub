import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useAuth } from "@/lib/auth";
import { inviteUser } from "@/lib/admin.functions";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Dcalice" },
      { name: "description", content: "Cadastro de usuários, papéis e equipes de venda." },
      { property: "og:title", content: "Usuários — Dcalice" },
      { property: "og:description", content: "Cadastro de usuários, papéis e equipes de venda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const ROLES = ["vendedor", "supervisor", "administrador", "cliente"] as const;
type Role = (typeof ROLES)[number];
const NONE = "__none";

function Page() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = profile?.role === "administrador";

  const users = useQuery({
    queryKey: ["profiles", "admin"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, phone, role, supervisor_id, is_active").order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const customers = useQuery({
    queryKey: ["customers", "portal-links"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, portal_user_id").order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!isAdmin) return <NoAccess />;
  const supervisors = (users.data ?? []).filter((u) => u.role === "supervisor");

  async function update(id: string, patch: { role?: Role; supervisor_id?: string | null; is_active?: boolean }) {
    if (id === profile!.id && (patch.role && patch.role !== "administrador" || patch.is_active === false)) {
      return void toast.error("Você não pode tirar o seu próprio acesso de administrador");
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return void toast.error("Não foi possível salvar a alteração");
    toast.success("Usuário atualizado");
    void qc.invalidateQueries({ queryKey: ["profiles"] });
  }
  async function linkCustomer(userId: string, customerId: string) {
    await supabase.from("customers").update({ portal_user_id: null }).eq("portal_user_id", userId);
    if (customerId !== NONE) {
      const { error } = await supabase.from("customers").update({ portal_user_id: userId }).eq("id", customerId);
      if (error) return void toast.error("Não foi possível ligar o cliente");
    }
    toast.success("Cadastro do cliente atualizado");
    void qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1"><PageHeader title="Usuários" description="Papéis, equipes de venda e acesso de cada pessoa." /></div>
        <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Convidar usuário</Button>
      </div>

      {users.isLoading ? <RowsSkeleton rows={4} /> : users.isError ? (
        <ErrorState message="Não foi possível carregar os usuários" onRetry={() => users.refetch()} />
      ) : !users.data?.length ? (
        <EmptyState title="Nenhum usuário ainda">Convide a equipe pelo botão acima.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {users.data.map((u) => {
            const linked = customers.data?.find((c) => c.portal_user_id === u.id);
            return (
              <li key={u.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.full_name}</span>
                  {u.id === profile!.id && <Badge variant="outline">Você</Badge>}
                  {!u.is_active && <Badge variant="destructive">Inativo</Badge>}
                  <label className="ml-auto flex items-center gap-2 text-sm">
                    Ativo <Switch checked={u.is_active} onCheckedChange={(v) => update(u.id, { is_active: v })} />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Papel</Label>
                    <Select value={u.role} onValueChange={(v) => update(u.id, { role: v as Role, ...(v !== "vendedor" ? { supervisor_id: null } : {}) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {u.role === "vendedor" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Supervisor</Label>
                      <Select value={u.supervisor_id ?? NONE} onValueChange={(v) => update(u.id, { supervisor_id: v === NONE ? null : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem supervisor</SelectItem>
                          {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {u.role === "cliente" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Cadastro de cliente</Label>
                      <Select value={linked?.id ?? NONE} onValueChange={(v) => linkCustomer(u.id, v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Não ligado</SelectItem>
                          {customers.data?.filter((c) => !c.portal_user_id || c.portal_user_id === u.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <InviteDialog open={open} onOpenChange={setOpen} supervisors={supervisors} customers={(customers.data ?? []).filter((c) => !c.portal_user_id)} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, supervisors, customers }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  supervisors: { id: string; full_name: string }[]; customers: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteUser);
  const [form, setForm] = useState({ email: "", full_name: "", role: "vendedor" as Role, supervisor_id: NONE, customer_id: NONE });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await inviteFn({ data: { email: form.email, full_name: form.full_name, role: form.role,
        supervisor_id: form.supervisor_id === NONE ? null : form.supervisor_id, customer_id: form.customer_id === NONE ? null : form.customer_id } });
      toast.success("Convite enviado por email");
      onOpenChange(false);
      setForm({ email: "", full_name: "", role: "vendedor", supervisor_id: NONE, customer_id: NONE });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível convidar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="inv-name">Nome</Label><Input id="inv-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="inv-email">Email</Label><Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Papel</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.role === "vendedor" && (
            <div className="space-y-1">
              <Label>Supervisor</Label>
              <Select value={form.supervisor_id} onValueChange={(v) => setForm({ ...form, supervisor_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Sem supervisor</SelectItem>{supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.role === "cliente" && (
            <div className="space-y-1">
              <Label>Cadastro de cliente</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Escolha o cliente</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={busy || !form.email || !form.full_name} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar convite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
