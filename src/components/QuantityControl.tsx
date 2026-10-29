import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuantityControl({ name, quantity, disabled, onIncrease, onDecrease }: {
  name: string; quantity: number; disabled?: boolean;
  onIncrease: () => void; onDecrease: () => void;
}) {
  return (
    <div className="flex h-11 w-32 shrink-0 items-center justify-end gap-1">
      {quantity > 0 && <>
        <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" disabled={disabled} onClick={onDecrease} aria-label={`Diminuir ${name}`} title={`Diminuir ${name}`}>
          {quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        </Button>
        <span className="w-8 text-center font-semibold tabular-nums" aria-label={`Quantidade de ${name}`}>{quantity}</span>
      </>}
      <Button size="icon" className="h-10 w-10 shrink-0" disabled={disabled} onClick={onIncrease} aria-label={`Adicionar ${name}`} title={`Adicionar ${name}`}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}