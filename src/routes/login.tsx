import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, useAuth } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Dcalice" },
      { name: "description", content: "Acesse sua conta no Dcalice com email e senha ou link de acesso." },
      { property: "og:title", content: "Entrar — Dcalice" },
      { property: "og:description", content: "Login individual da equipe comercial e clientes da distribuidora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "senha" | "link" | "esqueci";

function LoginPage() {
  const { ready, session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("senha");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !session || !profile) return;
    if (!profile.is_active) {
      setError("Seu usuário está inativo. Fale com o administrador da distribuidora.");
      void signOut();
      return;
    }
    navigate({ to: homeForRole(profile.role), replace: true });
  }, [ready, session, profile, navigate, signOut]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setLoading(true);
    try {
      if (mode === "senha") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message.includes("Invalid") ? "Email ou senha inválidos." : error.message);
      } else if (mode === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        });
        if (error) setError("Não foi possível enviar o link. Confira o email cadastrado.");
        else setSent("Verifique seu email: enviamos um link de acesso.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) setError("Não foi possível enviar o email de redefinição.");
        else setSent("Verifique seu email para redefinir a senha.");
      }
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-brand p-10 lg:flex">
        <Brand inverted />
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight text-sidebar-foreground">
            Toda a operação comercial da distribuidora, no bolso do vendedor.
          </h1>
          <p className="mt-4 text-sidebar-foreground/70">
            Indicadores, pedidos, clientes, produtos, e-commerce e agenda em uma única interface.
          </p>
        </div>
        <p className="text-sm text-sidebar-foreground/70">Força de vendas para distribuidoras</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h2 className="text-2xl font-bold">
            {mode === "senha" ? "Entrar" : mode === "link" ? "Receber link de acesso" : "Esqueci minha senha"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "senha"
              ? "Use o email e a senha da sua conta."
              : mode === "link"
                ? "Para clientes do E-commerce: enviamos um link para seu email."
                : "Enviaremos um link para criar uma nova senha."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode === "senha" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setMode("esqueci")}
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {sent && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>{sent}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "senha" ? "Entrar" : "Enviar link"}
            </Button>
          </form>

          <div className="mt-4">
            {mode === "senha" ? (
              <Button variant="outline" className="w-full" onClick={() => setMode("link")}>
                <Mail className="h-4 w-4" /> Receber link de acesso
              </Button>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setMode("senha")}>
                Voltar para email e senha
              </Button>
            )}
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Acesso individual. Contas são criadas pelo administrador da distribuidora.
          </p>
        </div>
      </main>
    </div>
  );
}

