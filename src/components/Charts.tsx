import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Investment, ProjectionResult, ProjectionSettings } from "../types";
import { formatCompactCurrency, formatCurrency, formatMonth } from "../utils/formatters";

interface ChartsProps {
  result: ProjectionResult;
  investments: Investment[];
  viewMode: ProjectionSettings["viewMode"];
}

export function Charts({ result, investments, viewMode }: ChartsProps) {
  const valueKey = viewMode === "inflationAdjusted" ? "inflationAdjustedValue" : "totalValue";
  const chartData = result.monthly.map((row) => {
    const investmentValues = Object.fromEntries(
      row.byInvestment.map((item) => [item.name, viewMode === "inflationAdjusted" ? item.inflationAdjustedValue : item.value])
    );
    return {
      month: formatMonth(row.date),
      date: row.date,
      portfolio: row[valueKey],
      contributions: row.cumulativeContributions,
      gains: Math.max(0, row.cumulativeGains),
      ...investmentValues
    };
  });

  const allocation = result.summary.investmentSummaries.map((summary) => ({
    name: summary.name,
    value: summary.endingValue,
    color: investments.find((investment) => investment.id === summary.investmentId)?.color ?? "#64748b"
  }));

  const contributionGainData = result.monthly.filter((_, index) => index % 12 === 0 || index === result.monthly.length - 1).map((row) => ({
    month: formatMonth(row.date),
    Contributions: row.cumulativeContributions,
    Gains: Math.max(0, row.cumulativeGains)
  }));

  return (
    <section className="charts-grid">
      <article className="panel chart-panel wide">
        <div className="panel__heading compact">
          <h2>Portfolio value over time</h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" minTickGap={36} />
            <YAxis tickFormatter={formatCompactCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Line type="monotone" dataKey="portfolio" name={viewMode === "inflationAdjusted" ? "Inflation-adjusted value" : "Portfolio value"} stroke="#2563eb" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </article>

      <article className="panel chart-panel wide">
        <div className="panel__heading compact">
          <h2>Stacked value by investment</h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" minTickGap={36} />
            <YAxis tickFormatter={formatCompactCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            {investments.map((investment) => (
              <Area key={investment.id} type="monotone" dataKey={investment.name} stackId="1" stroke={investment.color} fill={investment.color} fillOpacity={0.72} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </article>

      <article className="panel chart-panel">
        <div className="panel__heading compact">
          <h2>Contributions vs gains</h2>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={contributionGainData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" minTickGap={28} />
            <YAxis tickFormatter={formatCompactCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="Contributions" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gains" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className="panel chart-panel">
        <div className="panel__heading compact">
          <h2>Ending allocation</h2>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={64} outerRadius={104} paddingAngle={2}>
              {allocation.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}
