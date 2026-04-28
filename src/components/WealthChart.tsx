import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AgeProjection } from "../utils/wealthProjection";
import { formatCompactCurrency, formatCurrency } from "../utils/formatters";

interface WealthChartProps {
  data: AgeProjection[];
  selectedAge: number | null;
  onSelectAge: (age: number) => void;
}

export function WealthChart({ data, selectedAge, onSelectAge }: WealthChartProps) {
  const isDark = document.documentElement.dataset.theme === "dark";
  const lineColor = isDark ? "#e5edf9" : "#0f172a";
  const chartData = data.map((point) => ({
    ...point,
    expenseBar: -point.annualCashOutflows
  }));

  return (
    <section className="panel wealth-chart-panel">
      <div className="panel__heading compact">
        <div>
          <p className="eyebrow">Main projection</p>
          <h2>Income, expenses, and assets by age</h2>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={460}>
        <ComposedChart
          data={chartData}
          onClick={(event) => {
            const payload = event?.activePayload?.[0]?.payload as AgeProjection | undefined;
            if (payload) onSelectAge(payload.age);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="age" tickFormatter={(age) => `Age ${age}`} />
          <YAxis tickFormatter={formatCompactCurrency} />
          <ReferenceLine y={0} stroke="#64748b" />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value)), name]}
            labelFormatter={(age) => `Age ${age}`}
            contentStyle={{ borderRadius: 8 }}
          />
          <Legend />
          <Bar dataKey="investmentValue" name="Investment value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="annualIncome" name="Active income" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="annualDividendIncome" name="Dividend income" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenseBar" name="Expenses, events, and contributions" fill="#dc2626" radius={[0, 0, 4, 4]} />
          <Line
            type="monotone"
            dataKey="totalAssets"
            name="Total assets"
            stroke={lineColor}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: isDark ? "#182235" : "#ffffff", stroke: lineColor }}
            activeDot={{ r: 7, strokeWidth: 2, fill: "#ffffff", stroke: "#2563eb" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="chart-hint">
        Hover an age marker or bar to see that year. Click any age to inspect how its asset value and cash flow are calculated.
      </p>
      {selectedAge ? <span className="selected-age-pill">Selected age {selectedAge}</span> : null}
    </section>
  );
}

