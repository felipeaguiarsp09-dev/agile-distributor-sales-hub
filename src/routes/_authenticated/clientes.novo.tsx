import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { NoAccess } from "@/components/shared";
import { CustomerForm } from "@/components/CustomerForm";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  head: () => ({
    meta: [
      { title: "Novo cliente — Dcalice" },
      { name: "description", content: "Cadastrar um cliente na carteira da distribuidora." },
      { property: "og:title", content: "Novo cliente — Dcalice" },
      { property: "og:description", content: "Cadastrar um cliente na carteira da distribuidora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCustomer,
});

function NewCustomer() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!profile || profile.role !== "administrador") return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo cliente" description="Cadastre um cliente e escolha o vendedor responsável." />
      <CustomerForm
        submitLabel="Cadastrar cliente"
        initial={{ name: "", cnpj_cpf: null, email: null, phone: null, credit_limit: 0, credit_status: "ok", owner_id: profile.id, address: {} }}
        onSubmit={async (v) => {
          const { data, error } = await supabase
            .from("customers")
            .insert({ ...v, organization_id: profile.organization_id })
            .select("id")
            .single();
          if (error) return void toast.error("Não foi possível cadastrar o cliente");
          toast.success("Cliente cadastrado");
          await qc.invalidateQueries({ queryKey: ["customers"] });
          navigate({ to: "/clientes/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
