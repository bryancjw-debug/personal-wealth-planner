import type { Investment, ProjectionResult } from "../types";
import { formatCurrency, formatMonth } from "../utils/formatters";

interface ProjectionTableProps {
  result: ProjectionResult;
  investments: Investment[];
}

export function ProjectionTable({ result, investments }: ProjectionTableProps) {
  const rows = result.monthly;

  return (
    <section className="panel table-panel">
      <div className="panel__heading compact">
        <h2>Month-by-month projection</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Age</th>
              <th>Contributions</th>
              <th>Dividends</th>
              {investments.map((investment) => (
                <th key={investment.id}>
                  <span className="legend-chip" style={{ background: investment.color }} />
                  {investment.name}
                </th>
              ))}
              <th>Total value</th>
              <th>Cumulative contributions</th>
              <th>Cumulative gains</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{formatMonth(row.date)}</td>
                <td>{row.age.toFixed(1)}</td>
                <td>{formatCurrency(row.contributions)}</td>
                <td>{formatCurrency(row.dividends)}</td>
                {investments.map((investment) => {
                  const snapshot = row.byInvestment.find((item) => item.investmentId === investment.id);
                  return <td key={investment.id}>{formatCurrency(snapshot?.value ?? 0)}</td>;
                })}
                <td>{formatCurrency(row.totalValue)}</td>
                <td>{formatCurrency(row.cumulativeContributions)}</td>
                <td>{formatCurrency(row.cumulativeGains)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
