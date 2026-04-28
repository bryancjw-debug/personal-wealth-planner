import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}

export function MetricCard({ label, value, detail, tone = "neutral", icon }: MetricCardProps) {
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </section>
  );
}
