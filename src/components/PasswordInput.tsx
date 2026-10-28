import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Campo de senha com botão de olho para mostrar/ocultar o valor digitado. */
export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    // O tipo controlado pelo olho vence: ignora qualquer "type" recebido.
    const { type: _ignoredType, ...rest } = props;
    return (
      <div
        className="relative"
        // Ao sair do campo (clicando fora ou tabulando), esconde de novo.
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setVisible(false);
        }}
      >
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className="pr-11"
          {...rest}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          // Evita tirar o foco do campo: clicar no olho não conta como sair do campo.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  },
);
