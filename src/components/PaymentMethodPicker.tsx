import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  matchesPaymentMethodSearch,
  paymentMethodSummary,
  type ErpPaymentMethod,
  visiblePaymentMethods,
} from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

type Props = {
  /** Formas cadastradas pelo ERP. */
  methods: ErpPaymentMethod[] | undefined;
  selected: string;
  onSelect: (code: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/** Lista as formas de pagamento do ERP com busca; a escolhida fica destacada num resumo sempre visível, com a lista aberta ou fechada. */
export function PaymentMethodPicker({ methods, selected, onSelect, isLoading = false, disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const all = visiblePaymentMethods(methods, selected);
  const shown = all.filter((m) => matchesPaymentMethodSearch(m, query));
  const summary = paymentMethodSummary(selected, all);

  // Com a lista aberta, a forma escolhida entra na área visível da rolagem.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, selected, query]);

  return (
    <div className="space-y-1">
      <Label id="payment-method-label">Forma de pagamento</Label>
      {isLoading ? (
        <p className="pt-1 text-sm text-muted-foreground">Carregando as formas de pagamento do ERP...</p>
      ) : all.length === 0 ? (
        <p className="pt-1 text-sm text-muted-foreground">
          O ERP ainda não enviou as formas de pagamento. Peça a importação da base.
        </p>
      ) : (
        <>
          {summary && (
            <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Forma escolhida</p>
                <p className="truncate font-semibold text-primary">{summary.name}</p>
              </div>
              {summary.requiresDays && <span className="shrink-0 text-xs text-muted-foreground">com prazo</span>}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="payment-method-list"
                disabled={disabled}
                className="shrink-0 rounded-md border border-primary/30 bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {open ? (
                  <span className="flex items-center gap-1">
                    Ocultar <ChevronUp className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    Alterar <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            </div>
          )}
          {open && (
            <>
              {all.length > 4 && (
                <div className="relative pt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar forma de pagamento..."
                    aria-label="Buscar forma de pagamento"
                    className="h-9 pl-9"
                  />
                </div>
              )}
              <div
                ref={listRef}
                id="payment-method-list"
                role="radiogroup"
                aria-labelledby="payment-method-label"
                className="max-h-60 space-y-1 overflow-y-auto rounded-lg border bg-background p-1"
              >
                {shown.map((m) => {
                  const isOn = selected === m.code;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      role="radio"
                      aria-checked={isOn}
                      disabled={disabled}
                      onClick={() => onSelect(m.code)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        isOn ? "border border-primary bg-primary/10 font-semibold text-primary" : "border border-transparent hover:bg-accent",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          isOn ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {isOn && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {m.requires_days && <span className="shrink-0 text-xs font-normal text-muted-foreground">com prazo</span>}
                    </button>
                  );
                })}
                {shown.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma forma de pagamento encontrada para "{query}".</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
