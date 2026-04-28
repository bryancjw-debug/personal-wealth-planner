import { useEffect, useMemo, useState } from "react";
import { Download, Moon, RotateCcw, Save, Sun, Upload } from "lucide-react";
import { AgeBreakdown } from "./components/AgeBreakdown";
import { MetricCard } from "./components/MetricCard";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { WealthChart } from "./components/WealthChart";
import { formatCurrency } from "./utils/formatters";
import {
  defaultWealthProfile,
  monthlyExpenses,
  monthlyIncome,
  projectWealth,
  validateWealthProfile,
  type WealthProfile
} from "./utils/wealthProjection";
import "./styles.css";

const STORAGE_KEY = "guided-wealth-projection-v2";

function loadSavedProfile(): WealthProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultWealthProfile;
    const parsed = JSON.parse(saved) as Partial<WealthProfile>;
    return {
      ...defaultWealthProfile,
      ...parsed,
      projectionEndAge: Math.max(parsed.projectionEndAge ?? defaultWealthProfile.projectionEndAge, 100),
      incomeItems: parsed.incomeItems ?? defaultWealthProfile.incomeItems,
      expenseItems: parsed.expenseItems ?? defaultWealthProfile.expenseItems,
      cashFlowEvents: parsed.cashFlowEvents ?? defaultWealthProfile.cashFlowEvents,
      assetShiftEvents: parsed.assetShiftEvents ?? defaultWealthProfile.assetShiftEvents,
      assets: (parsed.assets ?? defaultWealthProfile.assets).map((asset, index) => ({
        ...defaultWealthProfile.assets[index % defaultWealthProfile.assets.length],
        ...asset
      }))
    };
  } catch {
    return defaultWealthProfile;
  }
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [profile, setProfile] = useState<WealthProfile>(() => loadSavedProfile());
  const [step, setStep] = useState(1);
  const [showDashboard, setShowDashboard] = useState(false);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

  const projection = useMemo(() => projectWealth(profile), [profile]);
  const errors = useMemo(() => validateWealthProfile(profile), [profile]);
  const selectedPoint = projection.find((point) => point.age === selectedAge) ?? null;
  const lastPoint = projection.at(-1);
  const firstPoint = projection[0];
  const income = monthlyIncome(profile);
  const expenses = monthlyExpenses(profile);
  const monthlyExcess = Math.max(0, income - expenses);

  useEffect(() => {
    document.documentElement.dataset.theme = profile.darkMode ? "dark" : "light";
  }, [profile.darkMode]);

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  const load = () => setProfile(loadSavedProfile());
  const reset = () => {
    setProfile(defaultWealthProfile);
    setStep(1);
    setShowDashboard(false);
    setSelectedAge(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportCsv = () => {
    const headers = [
      "Age",
      "Projected Investments",
      "Free Cash",
      "Total Assets",
      "Annual Income",
      "Annual Expenses",
      "Dividend Income",
      "Life Event Costs",
      "Cash Outflows",
      "Annual Excess Cash",
      "Investment Contributions",
      "Dividends Paid Out",
      "Investment Drawdown",
      "Net Cash Flow"
    ];
    const rows = projection.map((point) => [
      point.age,
      point.investmentValue.toFixed(2),
      point.freeCash.toFixed(2),
      point.totalAssets.toFixed(2),
      point.annualIncome.toFixed(2),
      point.annualExpenses.toFixed(2),
      point.annualDividendIncome.toFixed(2),
      point.annualLifeEventCosts.toFixed(2),
      point.annualCashOutflows.toFixed(2),
      point.annualExcessCash.toFixed(2),
      point.annualInvestmentContributions.toFixed(2),
      point.annualDividendsPaidOut.toFixed(2),
      point.annualDrawdown.toFixed(2),
      point.netCashFlow.toFixed(2)
    ]);
    download("guided-wealth-projection.csv", [headers, ...rows].map((row) => row.join(",")).join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <main className="app-shell guided-app">
      <header className="hero guided-hero">
        <div>
          <p className="eyebrow">Guided wealth projection</p>
          <h1>Map your assets from today to tomorrow</h1>
          <p className="hero__copy">
            Start with the basics, add income and expenses, then layer in your investment portfolio. The dashboard shows projected investments plus free cash after expenses by age.
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost-button" type="button" onClick={load}>
            <Upload size={16} /> Load
          </button>
          <button className="ghost-button" type="button" onClick={save}>
            <Save size={16} /> Save
          </button>
          <button className="ghost-button" type="button" onClick={reset}>
            <RotateCcw size={16} /> Reset
          </button>
          <button className="icon-button" type="button" onClick={() => setProfile({ ...profile, darkMode: !profile.darkMode })} aria-label="Toggle theme">
            {profile.darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {errors.length ? (
        <section className="error-panel" role="alert">
          {errors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </section>
      ) : null}

      {!showDashboard ? (
        <OnboardingWizard
          profile={profile}
          step={step}
          onStepChange={setStep}
          onProfileChange={setProfile}
          onComplete={() => {
            setShowDashboard(true);
            setSelectedAge(profile.age);
          }}
        />
      ) : (
        <>
          <section className="metrics-grid guided-metrics">
            <MetricCard label="Projected assets" value={formatCurrency(lastPoint?.totalAssets ?? 0)} detail={`At age ${lastPoint?.age ?? profile.age}`} tone="positive" />
            <MetricCard label="Projected investments" value={formatCurrency(lastPoint?.investmentValue ?? 0)} detail="Current portfolio compounded by asset return" />
            <MetricCard label="Accumulated free cash" value={formatCurrency(lastPoint?.freeCash ?? 0)} detail="Excess cash not invested after expenses" />
            <MetricCard label="Monthly excess cash" value={formatCurrency(monthlyExcess)} detail={`${formatCurrency(income)} income - ${formatCurrency(expenses)} expenses`} tone={monthlyExcess > 0 ? "positive" : "negative"} />
          </section>

          <div className="dashboard-actions">
            <button className="ghost-button" type="button" onClick={() => setShowDashboard(false)}>
              Edit inputs
            </button>
            <button className="primary-button" type="button" onClick={exportCsv}>
              <Download size={16} /> Export CSV
            </button>
          </div>

          <WealthChart data={projection} selectedAge={selectedAge} onSelectAge={setSelectedAge} />
          <AgeBreakdown point={selectedPoint ?? firstPoint ?? null} onClose={() => setSelectedAge(null)} />

          <section className="panel input-summary-panel">
            <div className="panel__heading compact">
              <h2>Inputs used in this projection</h2>
            </div>
            <div className="input-summary-grid">
              <div>
                <span>Name</span>
                <strong>{profile.name}</strong>
              </div>
              <div>
                <span>Age range</span>
                <strong>
                  {profile.age} to {profile.projectionEndAge}
                </strong>
              </div>
              <div>
                <span>Monthly income</span>
                <strong>{formatCurrency(income)}</strong>
              </div>
              <div>
                <span>Monthly expenses</span>
                <strong>{formatCurrency(expenses)}</strong>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="disclaimer">
        Projections are estimates based on the assumptions entered and are not financial advice. Assets here mean projected current investment values plus excess cash not invested after expenses.
      </footer>
    </main>
  );
}

export default App;
