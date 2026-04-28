import { X } from "lucide-react";
import type { AgeProjection } from "../utils/wealthProjection";
import { formatCurrency } from "../utils/formatters";

interface AgeBreakdownProps {
  point: AgeProjection | null;
  onClose: () => void;
}

export function AgeBreakdown({ point, onClose }: AgeBreakdownProps) {
  if (!point) return null;

  return (
    <section className="panel breakdown-panel">
      <div className="panel__heading compact">
        <div>
          <p className="eyebrow">Selected age</p>
          <h2>Age {point.age} asset breakdown</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close age breakdown">
          <X size={18} />
        </button>
      </div>

      <div className="breakdown-grid">
        <div>
          <span>Projected investments</span>
          <strong>{formatCurrency(point.investmentValue)}</strong>
        </div>
        <div>
          <span>Free cash</span>
          <strong>{formatCurrency(point.freeCash)}</strong>
        </div>
        <div>
          <span>Total assets</span>
          <strong>{formatCurrency(point.totalAssets)}</strong>
        </div>
        <div>
          <span>Annual excess cash</span>
          <strong>{formatCurrency(point.annualExcessCash)}</strong>
        </div>
        <div>
          <span>Investment contributions</span>
          <strong>{formatCurrency(point.annualInvestmentContributions)}</strong>
        </div>
        <div>
          <span>Dividends paid out</span>
          <strong>{formatCurrency(point.annualDividendsPaidOut)}</strong>
        </div>
        <div>
          <span>Active income</span>
          <strong>{formatCurrency(point.annualIncome)}</strong>
        </div>
        <div>
          <span>Cash outflows</span>
          <strong>{formatCurrency(point.annualCashOutflows)}</strong>
        </div>
        <div>
          <span>Net cash flow</span>
          <strong>{formatCurrency(point.netCashFlow)}</strong>
        </div>
        <div>
          <span>Investment drawdown</span>
          <strong>{formatCurrency(point.annualDrawdown)}</strong>
        </div>
      </div>

      <div className="calculation-note">
        Assets = projected investment values + accumulated excess cash not invested after expenses.
      </div>

      <div className="snapshot-section">
        <h3>Year snapshot</h3>
        <div className="snapshot-grid">
          <div>
            <span>Active income</span>
            <strong>{formatCurrency(point.annualIncome)}</strong>
            <small>Employment, business, and other non-dividend income</small>
          </div>
          <div>
            <span>Dividend income</span>
            <strong>{formatCurrency(point.annualDividendIncome)}</strong>
            <small>Dividends paid out instead of reinvested</small>
          </div>
          <div>
            <span>Expenses</span>
            <strong>{formatCurrency(point.annualExpenses + point.annualLifeEventCosts)}</strong>
            <small>Recurring expenses plus one-time life-event costs</small>
          </div>
          <div>
            <span>Investment contributions</span>
            <strong>{formatCurrency(point.annualInvestmentContributions)}</strong>
            <small>Planned contributions into investment holdings</small>
          </div>
          <div>
            <span>Nett cash flow</span>
            <strong>{formatCurrency(point.netCashFlow)}</strong>
            <small>Income and dividends less expenses, events, and contributions</small>
          </div>
          <div>
            <span>Investment holdings</span>
            <strong>{formatCurrency(point.investmentValue)}</strong>
            <small>{point.assetBreakdown.length} holdings in projection</small>
          </div>
          <div>
            <span>Free cash</span>
            <strong>{formatCurrency(point.freeCash)}</strong>
            <small>Accumulated cash outside investment holdings</small>
          </div>
          <div>
            <span>Total assets</span>
            <strong>{formatCurrency(point.totalAssets)}</strong>
            <small>Investments plus free cash</small>
          </div>
        </div>
      </div>

      <div className="event-breakdown">
        <h3>Life events triggered at age {point.age}</h3>
        {point.triggeredLifeEvents.length ? (
          <div className="event-breakdown__list">
            {point.triggeredLifeEvents.map((event) => (
              <div key={event.id}>
                <strong>{event.label}</strong>
                <span>
                  {event.type} - one-time cost {formatCurrency(event.oneTimeCost)} - income change {formatCurrency(event.monthlyIncomeChange)}/mo - expense change {formatCurrency(event.monthlyExpenseChange)}/mo
                  {event.setIncomeToZero ? " - active income set to zero" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>No life event starts at this age.</p>
        )}
      </div>

      <div className="asset-breakdown-table">
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Projected value</th>
              <th>Contribution</th>
              <th>Dividends</th>
              <th>Growth</th>
            </tr>
          </thead>
          <tbody>
            {point.assetBreakdown.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <span className="legend-chip" style={{ background: asset.color }} />
                  {asset.label}
                </td>
                <td>{asset.type}</td>
                <td>{formatCurrency(asset.value)}</td>
                <td>{formatCurrency(asset.contribution)}</td>
                <td>{formatCurrency(asset.dividends)}</td>
                <td>{formatCurrency(asset.growth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
