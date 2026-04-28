import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AssetType, DividendTreatment, Investment, InvestmentFrequency } from "../types";
import { DEFAULT_RETURNS, DEFAULT_VOLATILITY, INVESTMENT_COLORS } from "../utils/projection";
import { TooltipLabel } from "./TooltipLabel";

const assetTypes: AssetType[] = [
  "Equities",
  "Funds / ETFs",
  "Bonds",
  "Cash holdings",
  "Crypto",
  "Commodities",
  "Other"
];

const frequencies: InvestmentFrequency[] = ["One-time", "Monthly", "Quarterly", "Semi-annually", "Annually"];
const dividendTreatments: DividendTreatment[] = ["Reinvest dividends", "Take dividends as cash"];

interface InvestmentFormProps {
  investments: Investment[];
  onChange: (investments: Investment[]) => void;
  onReset: () => void;
}

function nextInvestment(index: number): Investment {
  return {
    id: crypto.randomUUID(),
    name: `Investment ${index + 1}`,
    type: "Equities",
    annualReturn: DEFAULT_RETURNS.Equities,
    amount: 500,
    frequency: "Monthly",
    dividendYield: 1.5,
    dividendTreatment: "Reinvest dividends",
    annualContributionIncrease: 0,
    taxRate: 0,
    expenseRatio: 0.1,
    volatility: DEFAULT_VOLATILITY.Equities,
    color: INVESTMENT_COLORS[index % INVESTMENT_COLORS.length]
  };
}

function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  label,
  tip
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  tip?: string;
}) {
  return (
    <label>
      {tip ? <TooltipLabel label={label} tip={tip} /> : label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function InvestmentForm({ investments, onChange, onReset }: InvestmentFormProps) {
  const updateInvestment = (id: string, patch: Partial<Investment>) => {
    onChange(investments.map((investment) => (investment.id === id ? { ...investment, ...patch } : investment)));
  };

  const addInvestment = () => onChange([...investments, nextInvestment(investments.length)]);

  const duplicateInvestment = (investment: Investment) => {
    onChange([
      ...investments,
      {
        ...investment,
        id: crypto.randomUUID(),
        name: `${investment.name} copy`,
        color: INVESTMENT_COLORS[investments.length % INVESTMENT_COLORS.length]
      }
    ]);
  };

  const deleteInvestment = (id: string) => onChange(investments.filter((investment) => investment.id !== id));

  return (
    <section className="panel investment-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Portfolio inputs</p>
          <h2>Investments</h2>
        </div>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={onReset}>
            <RotateCcw size={16} /> Reset
          </button>
          <button className="primary-button" type="button" onClick={addInvestment}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="investment-list">
        {investments.map((investment) => (
          <article className="investment-card" key={investment.id} style={{ borderColor: investment.color }}>
            <div className="investment-card__header">
              <span className="color-dot" style={{ background: investment.color }} />
              <input
                className="name-input"
                value={investment.name}
                onChange={(event) => updateInvestment(investment.id, { name: event.target.value })}
                aria-label="Investment name"
              />
              <button type="button" className="icon-button" onClick={() => duplicateInvestment(investment)} aria-label="Duplicate investment">
                <Copy size={16} />
              </button>
              <button type="button" className="icon-button danger" onClick={() => deleteInvestment(investment.id)} aria-label="Delete investment">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Type
                <select
                  value={investment.type}
                  onChange={(event) => {
                    const type = event.target.value as AssetType;
                    updateInvestment(investment.id, {
                      type,
                      annualReturn: DEFAULT_RETURNS[type],
                      volatility: DEFAULT_VOLATILITY[type]
                    });
                  }}
                >
                  {assetTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <NumericInput
                label="Expected return %"
                tip="Expected annual return is converted to a monthly compounded rate."
                value={investment.annualReturn}
                onChange={(value) => updateInvestment(investment.id, { annualReturn: value })}
                min={-99}
              />
              <NumericInput
                label="Amount"
                value={investment.amount}
                onChange={(value) => updateInvestment(investment.id, { amount: value })}
                min={0}
                step={100}
              />
              <label>
                Frequency
                <select value={investment.frequency} onChange={(event) => updateInvestment(investment.id, { frequency: event.target.value as InvestmentFrequency })}>
                  {frequencies.map((frequency) => (
                    <option key={frequency}>{frequency}</option>
                  ))}
                </select>
              </label>
              <NumericInput
                label="Dividend yield %"
                value={investment.dividendYield}
                onChange={(value) => updateInvestment(investment.id, { dividendYield: value })}
                min={0}
              />
              <label>
                <TooltipLabel label="Dividend treatment" tip="Reinvesting adds dividends back into portfolio value; taking cash tracks dividends separately." />
                <select value={investment.dividendTreatment} onChange={(event) => updateInvestment(investment.id, { dividendTreatment: event.target.value as DividendTreatment })}>
                  {dividendTreatments.map((treatment) => (
                    <option key={treatment}>{treatment}</option>
                  ))}
                </select>
              </label>
              <NumericInput
                label="Contribution increase %"
                value={investment.annualContributionIncrease}
                onChange={(value) => updateInvestment(investment.id, { annualContributionIncrease: value })}
                min={0}
              />
              <NumericInput
                label="Tax rate %"
                value={investment.taxRate}
                onChange={(value) => updateInvestment(investment.id, { taxRate: value })}
                min={0}
                max={100}
              />
              <NumericInput
                label="Fee / expense %"
                value={investment.expenseRatio}
                onChange={(value) => updateInvestment(investment.id, { expenseRatio: value })}
                min={0}
              />
              <NumericInput
                label="Volatility %"
                tip="Used by scenario comparison and the Monte Carlo simulation."
                value={investment.volatility}
                onChange={(value) => updateInvestment(investment.id, { volatility: value })}
                min={0}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
