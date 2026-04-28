import { Moon, Sun } from "lucide-react";
import type { ProjectionSettings } from "../types";
import { TooltipLabel } from "./TooltipLabel";

interface SettingsPanelProps {
  settings: ProjectionSettings;
  onChange: (settings: ProjectionSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const update = (patch: Partial<ProjectionSettings>) => onChange({ ...settings, ...patch });

  return (
    <section className="panel settings-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Projection settings</p>
          <h2>Timeline and assumptions</h2>
        </div>
        <button className="icon-button" type="button" onClick={() => update({ darkMode: !settings.darkMode })} aria-label="Toggle dark mode">
          {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="form-grid settings-grid">
        <label>
          Current age
          <input type="number" min={0} max={120} value={settings.currentAge} onChange={(event) => update({ currentAge: Number(event.target.value) })} />
        </label>
        <label>
          Start date
          <input type="date" value={settings.startDate} onChange={(event) => update({ startDate: event.target.value })} />
        </label>
        <label>
          End date
          <input type="date" value={settings.endDate} onChange={(event) => update({ endDate: event.target.value })} />
        </label>
        <label>
          <TooltipLabel label="Inflation %" tip="Inflation adjustment discounts future values back into today's purchasing power." />
          <input type="number" step={0.1} value={settings.inflationRate} onChange={(event) => update({ inflationRate: Number(event.target.value) })} />
        </label>
        <label>
          Goal target
          <input type="number" min={0} step={1000} value={settings.targetAmount} onChange={(event) => update({ targetAmount: Number(event.target.value) })} />
        </label>
        <label>
          Scenario
          <select value={settings.scenario} onChange={(event) => update({ scenario: event.target.value as ProjectionSettings["scenario"] })}>
            <option value="pessimistic">Pessimistic</option>
            <option value="base">Base</option>
            <option value="optimistic">Optimistic</option>
          </select>
        </label>
        <label>
          Chart values
          <select value={settings.viewMode} onChange={(event) => update({ viewMode: event.target.value as ProjectionSettings["viewMode"] })}>
            <option value="nominal">Nominal</option>
            <option value="inflationAdjusted">Inflation-adjusted</option>
          </select>
        </label>
      </div>
    </section>
  );
}
