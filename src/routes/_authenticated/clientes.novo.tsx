import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { NoAccess } from "@/components/shared";
import { CustomerForm } from "@/components/CustomerForm";
import { useServerFn } from "@tanstack/react-start";
import { sendCustomerToErp } from "@/lib/customers.functions";

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
  const sendFn = useServerFn(sendCustomerToErp);
  if (!profile || profile.role !== "administrador") return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo cliente" description="Pré-cadastro enviado ao ERP, que completa o cadastro. Pedidos ficam liberados depois disso." />
      <CustomerForm
        submitLabel="Enviar pré-cadastro"
        initial={{ name: "", cnpj_cpf: null, email: null, phone: null, notes: null, owner_id: profile.id, address: {} }}
        onSubmit={async (v) => {
          const { data, error } = await supabase
            .from("customers")
            .insert({ ...v, organization_id: profile.organization_id })
            .select("id")
            .single();
          if (error) return void toast.error("Não foi possível salvar o pré-cadastro");
          const res = await sendFn({ data: { customer_id: data.id } }).catch(() => ({ ok: false, message: "O ERP não recebeu o pré-cadastro. Tente reenviar." }));
          if (res.ok) toast.success(res.message); else toast.warning(`Pré-cadastro salvo. ${res.message}`);
          await qc.invalidateQueries({ queryKey: ["customers"] });
          navigate({ to: "/clientes/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
