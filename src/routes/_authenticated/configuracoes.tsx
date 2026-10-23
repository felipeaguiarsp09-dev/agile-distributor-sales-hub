import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Dcalice" },
      { name: "description", content: "Seu perfil e senha no Dcalice." },
      { property: "og:title", content: "Configurações — Dcalice" },
      { property: "og:description", content: "Seu perfil e senha no Dcalice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { profile, organizationName, session, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error("Falha ao salvar alterações. Tente novamente.");
    else {
      toast.success("Perfil atualizado.");
      await refreshProfile();
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("A senha precisa ter ao menos 8 caracteres."); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPw(false);
    if (error) toast.error("Não foi possível alterar a senha.");
    else {
      setPassword("");
      toast.success("Senha alterada.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Configurações" description="Gerencie seu perfil e sua senha." />
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={session?.user.email ?? ""} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  <Input value={profile ? ROLE_LABEL[profile.role as Role] : ""} disabled />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Distribuidora</Label>
                  <Input value={organizationName ?? ""} disabled />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Papel e distribuidora são alterados apenas pelo administrador.
              </p>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Alterar senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="pw">Nova senha</Label>
                <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary" disabled={savingPw}>
                {savingPw && <Loader2 className="h-4 w-4 animate-spin" />} Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
