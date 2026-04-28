import { Info } from "lucide-react";

interface TooltipLabelProps {
  label: string;
  tip: string;
}

export function TooltipLabel({ label, tip }: TooltipLabelProps) {
  return (
    <span className="tooltip-label">
      {label}
      <span className="tooltip-label__icon" tabIndex={0} aria-label={tip}>
        <Info size={14} />
        <span className="tooltip-label__content">{tip}</span>
      </span>
    </span>
  );
}
