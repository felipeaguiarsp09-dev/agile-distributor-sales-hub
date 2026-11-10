import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { NoAccess } from "@/components/shared";
import { ProductForm } from "@/components/ProductForm";

export const Route = createFileRoute("/_authenticated/produtos/novo")({
  head: () => ({
    meta: [
      { title: "Novo produto — Dcalice" },
      { name: "description", content: "Cadastrar um produto no catálogo da distribuidora." },
      { property: "og:title", content: "Novo produto — Dcalice" },
      { property: "og:description", content: "Cadastrar um produto no catálogo da distribuidora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewProduct,
});

function NewProduct() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!profile || profile.role !== "administrador") return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo produto" description="Cadastre um item no catálogo." />
      <ProductForm
        submitLabel="Cadastrar produto"
        initial={{ sku: "", name: "", description: null, category: null, unit_price: 0, stock_quantity: 0, is_ecommerce_visible: false, is_active: true, image_url: null }}
        onSubmit={async (v) => {
          const { data, error } = await supabase.from("products").insert({ ...v, stock_quantity: 0, organization_id: profile.organization_id }).select("id").single();
          if (error) return void toast.error("Não foi possível cadastrar o produto");
          toast.success("Produto cadastrado");
          await qc.invalidateQueries({ queryKey: ["products"] });
          navigate({ to: "/produtos/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
