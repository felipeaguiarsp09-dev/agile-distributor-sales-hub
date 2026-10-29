import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function EditableQuantity({ name, quantity, disabled, onQuantityChange }: {
  name: string; quantity: number; disabled?: boolean; onQuantityChange: (qty: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Input
      aria-label={`Quantidade de ${name}`}
      className="h-10 w-16 shrink-0 px-1 text-center font-semibold tabular-nums"
      type="number"
      min={1}
      inputMode="numeric"
      pattern="[0-9]*"
      value={text ?? String(quantity)}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v !== "") onQuantityChange(Number(v));
      }}
      onBlur={() => setText(null)}
    />
  );
}

export function QuantityControl({ name, quantity, disabled, children, onIncrease, onDecrease, onQuantityChange }: {
  name: string; quantity: number; disabled?: boolean; children?: React.ReactNode;
  onIncrease: () => void; onDecrease: () => void; onQuantityChange?: (qty: number) => void;
}) {
  return (
    <div className="flex h-11 w-auto shrink-0 items-center justify-end gap-1">
      {quantity > 0 && <>
        <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" disabled={disabled} onClick={onDecrease} aria-label={`Diminuir ${name}`} title={`Diminuir ${name}`}>
          {quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        </Button>
        {children ?? (onQuantityChange ? (
          <EditableQuantity name={name} quantity={quantity} disabled={disabled} onQuantityChange={onQuantityChange} />
        ) : (
          <span className="w-8 text-center font-semibold tabular-nums" aria-label={`Quantidade de ${name}`}>{quantity}</span>
        ))}
      </>}
      <Button size="icon" className="h-10 w-10 shrink-0" disabled={disabled} onClick={onIncrease} aria-label={`Adicionar ${name}`} title={`Adicionar ${name}`}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}
