import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import type { AssetShiftEvent, CashFlowEvent, CashFlowMode, NamedAmount, WealthAsset, WealthProfile } from "../utils/wealthProjection";
import { assetTypeDefaults, wealthColors } from "../utils/wealthProjection";

interface OnboardingWizardProps {
  profile: WealthProfile;
  step: number;
  onStepChange: (step: number) => void;
  onProfileChange: (profile: WealthProfile) => void;
  onComplete: () => void;
}

const assetTypes = Object.keys(assetTypeDefaults);

function patchList<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function nextItem(label: string): NamedAmount {
  return { id: crypto.randomUUID(), label, amount: 0 };
}

function nextAsset(index: number): WealthAsset {
  return {
    id: crypto.randomUUID(),
    label: `Investment ${index + 1}`,
    type: "Funds / ETFs",
    currentValue: 10000,
    expectedReturn: assetTypeDefaults["Funds / ETFs"],
    contributionAmount: 0,
    contributionFrequency: "None",
    contributionStartAge: 35,
    contributionEndAge: 65,
    dividendYield: 0,
    dividendTreatment: "Reinvest dividends",
    drawdownEnabled: true,
    color: wealthColors[index % wealthColors.length]
  };
}

function nextEvent(age: number): CashFlowEvent {
  return {
    id: crypto.randomUUID(),
    label: "Life event",
    type: "Custom",
    age,
    oneTimeCost: 0,
    monthlyIncomeChange: 0,
    monthlyExpenseChange: 0,
    setIncomeToZero: false
  };
}

function nextShift(profile: WealthProfile): AssetShiftEvent {
  return {
    id: crypto.randomUUID(),
    label: "Portfolio shift",
    age: Math.min(profile.projectionEndAge, profile.age + 20),
    fromAssetId: profile.assets[0]?.id ?? "",
    toAssetId: profile.assets[1]?.id ?? profile.assets[0]?.id ?? "",
    percentage: 25
  };
}

function presetEvent(type: CashFlowEvent["type"], age: number): CashFlowEvent {
  const presets: Record<CashFlowEvent["type"], Omit<CashFlowEvent, "id" | "age">> = {
    Custom: { label: "Life event", type: "Custom", oneTimeCost: 0, monthlyIncomeChange: 0, monthlyExpenseChange: 0, setIncomeToZero: false },
    Car: { label: "Buy a car", type: "Car", oneTimeCost: 60000, monthlyIncomeChange: 0, monthlyExpenseChange: 600, setIncomeToZero: false },
    House: { label: "Buy a house", type: "House", oneTimeCost: 120000, monthlyIncomeChange: 0, monthlyExpenseChange: 2500, setIncomeToZero: false },
    Wedding: { label: "Wedding", type: "Wedding", oneTimeCost: 40000, monthlyIncomeChange: 0, monthlyExpenseChange: 0, setIncomeToZero: false },
    Retirement: { label: "Retirement", type: "Retirement", oneTimeCost: 0, monthlyIncomeChange: 0, monthlyExpenseChange: -1200, setIncomeToZero: true }
  };
  return { id: crypto.randomUUID(), age, ...presets[type] };
}

function BufferedNumberInput({
  value,
  onCommit,
  min,
  placeholder
}: {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(String(Number.isFinite(value) ? value : 0));

  useEffect(() => {
    setDraft(String(Number.isFinite(value) ? value : 0));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(/,/g, ""));
    if (Number.isFinite(parsed)) onCommit(min !== undefined ? Math.max(min, parsed) : parsed);
  };

  return (
    <input
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ModeToggle({ value, onChange }: { value: CashFlowMode; onChange: (mode: CashFlowMode) => void }) {
  return (
    <div className="segmented">
      <button className={value === "generic" ? "active" : ""} type="button" onClick={() => onChange("generic")}>
        Generic sum
      </button>
      <button className={value === "breakdown" ? "active" : ""} type="button" onClick={() => onChange("breakdown")}>
        Breakdown
      </button>
    </div>
  );
}

export function OnboardingWizard({ profile, step, onStepChange, onProfileChange, onComplete }: OnboardingWizardProps) {
  const update = (patch: Partial<WealthProfile>) => onProfileChange({ ...profile, ...patch });
  const canGoNext = step < 3;

  return (
    <section className="wizard panel">
      <div className="wizard__rail" aria-label="Progress">
        {["Profile", "Cash flow", "Portfolio"].map((label, index) => (
          <button key={label} className={step === index + 1 ? "active" : ""} type="button" onClick={() => onStepChange(index + 1)}>
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <div className="wizard__page">
          <p className="eyebrow">Step 1</p>
          <h2>Tell us who this projection is for</h2>
          <div className="form-grid">
            <label>
              Name
              <input value={profile.name} onChange={(event) => update({ name: event.target.value })} placeholder="Your name" />
            </label>
            <label>
              Current age
              <BufferedNumberInput min={0} value={profile.age} onCommit={(age) => update({ age })} />
            </label>
            <label>
              Project until age
              <BufferedNumberInput min={profile.age} value={profile.projectionEndAge} onCommit={(projectionEndAge) => update({ projectionEndAge })} />
            </label>
            <label>
              Income growth / inflation %
              <BufferedNumberInput value={profile.incomeInflationRate} onCommit={(incomeInflationRate) => update({ incomeInflationRate })} />
            </label>
            <label>
              Expense inflation %
              <BufferedNumberInput value={profile.expenseInflationRate} onCommit={(expenseInflationRate) => update({ expenseInflationRate })} />
            </label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wizard__page">
          <p className="eyebrow">Step 2</p>
          <h2>Add income and expenses</h2>
          <div className="cashflow-grid">
            <CashFlowEditor
              title="Monthly income"
              mode={profile.incomeMode}
              genericValue={profile.monthlyIncome}
              items={profile.incomeItems}
              onModeChange={(mode) => update({ incomeMode: mode })}
              onGenericChange={(monthlyIncome) => update({ monthlyIncome })}
              onItemsChange={(incomeItems) => update({ incomeItems })}
              addLabel="Income source"
            />
            <CashFlowEditor
              title="Monthly expenses"
              mode={profile.expenseMode}
              genericValue={profile.monthlyExpenses}
              items={profile.expenseItems}
              onModeChange={(mode) => update({ expenseMode: mode })}
              onGenericChange={(monthlyExpenses) => update({ monthlyExpenses })}
              onItemsChange={(expenseItems) => update({ expenseItems })}
              addLabel="Expense category"
            />
          </div>
          <div className="events-section">
            <div className="panel__heading compact">
              <h3>Life events and cash-flow changes</h3>
              <button className="ghost-button" type="button" onClick={() => update({ cashFlowEvents: [...profile.cashFlowEvents, nextEvent(profile.age + 1)] })}>
                <Plus size={16} /> Add event
              </button>
            </div>
            <div className="line-items">
              {profile.cashFlowEvents.map((event) => (
                <div className="event-row" key={event.id}>
                  <label>
                    Event type
                    <select
                      value={event.type}
                      onChange={(change) => {
                        const replacement = { ...presetEvent(change.target.value as CashFlowEvent["type"], event.age), id: event.id };
                        update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, replacement) });
                      }}
                    >
                      <option>Custom</option>
                      <option>Car</option>
                      <option>House</option>
                      <option>Wedding</option>
                      <option>Retirement</option>
                    </select>
                  </label>
                  <input value={event.label} onChange={(change) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { label: change.target.value }) })} />
                  <label>
                    Age
                    <BufferedNumberInput min={profile.age} value={event.age} onCommit={(age) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { age }) })} />
                  </label>
                  <label>
                    One-time cost
                    <BufferedNumberInput min={0} value={event.oneTimeCost} onCommit={(oneTimeCost) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { oneTimeCost }) })} />
                  </label>
                  <label>
                    Monthly income increase / decrease
                    <BufferedNumberInput value={event.monthlyIncomeChange} onCommit={(monthlyIncomeChange) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { monthlyIncomeChange }) })} />
                  </label>
                  <label>
                    Monthly expense increase / decrease
                    <BufferedNumberInput value={event.monthlyExpenseChange} onCommit={(monthlyExpenseChange) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { monthlyExpenseChange }) })} />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={event.setIncomeToZero}
                      onChange={(change) => update({ cashFlowEvents: patchList(profile.cashFlowEvents, event.id, { setIncomeToZero: change.target.checked }) })}
                    />
                    Set active income to zero
                  </label>
                  <button className="icon-button danger" type="button" aria-label="Delete event" onClick={() => update({ cashFlowEvents: profile.cashFlowEvents.filter((item) => item.id !== event.id) })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard__page">
          <div className="panel__heading compact">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Add investment portfolio</h2>
            </div>
            <button className="primary-button" type="button" onClick={() => update({ assets: [...profile.assets, nextAsset(profile.assets.length)] })}>
              <Plus size={16} /> Add asset
            </button>
          </div>
          <div className="asset-list">
            {profile.assets.map((asset) => (
              <article className="asset-card" key={asset.id} style={{ borderColor: asset.color }}>
                <div className="asset-card__header">
                  <span className="color-dot" style={{ background: asset.color }} />
                  <input
                    className="name-input"
                    value={asset.label}
                    onChange={(event) => update({ assets: patchList(profile.assets, asset.id, { label: event.target.value }) })}
                  />
                  <button className="icon-button danger" type="button" aria-label="Delete asset" onClick={() => update({ assets: profile.assets.filter((item) => item.id !== asset.id) })}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    Investment type
                    <select
                      value={asset.type}
                      onChange={(event) => {
                        const type = event.target.value;
                        update({ assets: patchList(profile.assets, asset.id, { type, expectedReturn: assetTypeDefaults[type] }) });
                      }}
                    >
                      {assetTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Current value
                    <BufferedNumberInput min={0} value={asset.currentValue} onCommit={(currentValue) => update({ assets: patchList(profile.assets, asset.id, { currentValue }) })} />
                  </label>
                  <label>
                    Expected annual return %
                    <BufferedNumberInput min={-99} value={asset.expectedReturn} onCommit={(expectedReturn) => update({ assets: patchList(profile.assets, asset.id, { expectedReturn }) })} />
                  </label>
                  <label>
                    Contribution amount
                    <BufferedNumberInput min={0} value={asset.contributionAmount} onCommit={(contributionAmount) => update({ assets: patchList(profile.assets, asset.id, { contributionAmount }) })} />
                  </label>
                  <label>
                    Contribution frequency
                    <select value={asset.contributionFrequency} onChange={(event) => update({ assets: patchList(profile.assets, asset.id, { contributionFrequency: event.target.value as WealthAsset["contributionFrequency"] }) })}>
                      <option>None</option>
                      <option>Monthly</option>
                      <option>Annually</option>
                    </select>
                  </label>
                  <label>
                    Contribution start age
                    <BufferedNumberInput min={profile.age} value={asset.contributionStartAge} onCommit={(contributionStartAge) => update({ assets: patchList(profile.assets, asset.id, { contributionStartAge }) })} />
                  </label>
                  <label>
                    Contribution stop age
                    <BufferedNumberInput min={profile.age} value={asset.contributionEndAge} onCommit={(contributionEndAge) => update({ assets: patchList(profile.assets, asset.id, { contributionEndAge }) })} />
                  </label>
                  <label>
                    Dividend yield %
                    <BufferedNumberInput min={0} value={asset.dividendYield} onCommit={(dividendYield) => update({ assets: patchList(profile.assets, asset.id, { dividendYield }) })} />
                  </label>
                  <label>
                    Dividend treatment
                    <select value={asset.dividendTreatment} onChange={(event) => update({ assets: patchList(profile.assets, asset.id, { dividendTreatment: event.target.value as WealthAsset["dividendTreatment"] }) })}>
                      <option>Reinvest dividends</option>
                      <option>Take dividends as cash</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={asset.drawdownEnabled}
                      onChange={(event) => update({ assets: patchList(profile.assets, asset.id, { drawdownEnabled: event.target.checked }) })}
                    />
                    Allow retirement drawdown
                  </label>
                </div>
              </article>
            ))}
          </div>
          <div className="events-section">
            <div className="panel__heading compact">
              <h3>Asset allocation changes</h3>
              <button className="ghost-button" type="button" onClick={() => update({ assetShiftEvents: [...profile.assetShiftEvents, nextShift(profile)] })}>
                <Plus size={16} /> Add shift
              </button>
            </div>
            <div className="line-items">
              {profile.assetShiftEvents.map((event) => (
                <div className="shift-row" key={event.id}>
                  <input value={event.label} onChange={(change) => update({ assetShiftEvents: patchList(profile.assetShiftEvents, event.id, { label: change.target.value }) })} />
                  <label>
                    Age
                    <BufferedNumberInput min={profile.age} value={event.age} onCommit={(age) => update({ assetShiftEvents: patchList(profile.assetShiftEvents, event.id, { age }) })} />
                  </label>
                  <label>
                    From
                    <select value={event.fromAssetId} onChange={(change) => update({ assetShiftEvents: patchList(profile.assetShiftEvents, event.id, { fromAssetId: change.target.value }) })}>
                      {profile.assets.map((asset) => (
                        <option value={asset.id} key={asset.id}>
                          {asset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select value={event.toAssetId} onChange={(change) => update({ assetShiftEvents: patchList(profile.assetShiftEvents, event.id, { toAssetId: change.target.value }) })}>
                      {profile.assets.map((asset) => (
                        <option value={asset.id} key={asset.id}>
                          {asset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Shift %
                    <BufferedNumberInput min={0} value={event.percentage} onCommit={(percentage) => update({ assetShiftEvents: patchList(profile.assetShiftEvents, event.id, { percentage }) })} />
                  </label>
                  <button className="icon-button danger" type="button" aria-label="Delete asset shift" onClick={() => update({ assetShiftEvents: profile.assetShiftEvents.filter((item) => item.id !== event.id) })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="wizard__actions">
        <button className="ghost-button" type="button" disabled={step === 1} onClick={() => onStepChange(Math.max(1, step - 1))}>
          <ArrowLeft size={16} /> Back
        </button>
        {canGoNext ? (
          <button className="primary-button" type="button" onClick={() => onStepChange(step + 1)}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onComplete}>
            Build wealth chart <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

function CashFlowEditor({
  title,
  mode,
  genericValue,
  items,
  onModeChange,
  onGenericChange,
  onItemsChange,
  addLabel
}: {
  title: string;
  mode: CashFlowMode;
  genericValue: number;
  items: NamedAmount[];
  onModeChange: (mode: CashFlowMode) => void;
  onGenericChange: (value: number) => void;
  onItemsChange: (items: NamedAmount[]) => void;
  addLabel: string;
}) {
  return (
    <div className="cashflow-card">
      <div className="cashflow-card__header">
        <h3>{title}</h3>
        <ModeToggle value={mode} onChange={onModeChange} />
      </div>

      {mode === "generic" ? (
        <label>
          Generic monthly sum
          <BufferedNumberInput min={0} value={genericValue} onCommit={onGenericChange} />
        </label>
      ) : (
        <div className="line-items">
          {items.map((item) => (
            <div className="line-item" key={item.id}>
              <input value={item.label} onChange={(event) => onItemsChange(patchList(items, item.id, { label: event.target.value }))} />
              <BufferedNumberInput min={0} value={item.amount} onCommit={(amount) => onItemsChange(patchList(items, item.id, { amount }))} />
              <button className="icon-button danger" type="button" aria-label="Delete line item" onClick={() => onItemsChange(items.filter((entry) => entry.id !== item.id))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button className="ghost-button" type="button" onClick={() => onItemsChange([...items, nextItem(addLabel)])}>
            <Plus size={16} /> Add
          </button>
        </div>
      )}
    </div>
  );
}
