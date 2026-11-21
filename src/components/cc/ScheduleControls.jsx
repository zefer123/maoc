const field = 'mt-1 w-full rounded border border-white/20 bg-slate-950 p-2';

export default function ScheduleControls({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const rule = value.recurrence;
  return <fieldset className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-xs">
    <legend className="px-1 font-bold text-amber-200">RECURRING MISSION // UTC</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Schedule name<input required maxLength={100} value={value.name} onChange={(event) => update({ name: event.target.value })} className={field} /></label>
      <label>Recurrence<select value={rule.kind} onChange={(event) => update({ recurrence: event.target.value === 'interval' ? { kind: 'interval', minutes: 60 } : { kind: event.target.value, time: '09:00', ...(event.target.value === 'weekly' ? { weekday: 1 } : {}) } })} className={field}>
        <option value="interval">Every N minutes</option><option value="daily">Daily (UTC)</option><option value="weekly">Weekly (UTC)</option>
      </select></label>
      {rule.kind === 'interval' ? <label>Interval minutes<input required type="number" min={5} max={43200} step={1} value={rule.minutes} onChange={(event) => update({ recurrence: { ...rule, minutes: Number(event.target.value) } })} className={field} /></label>
        : <label>Time (UTC)<input required type="time" value={rule.time} onChange={(event) => update({ recurrence: { ...rule, time: event.target.value } })} className={field} /></label>}
      {rule.kind === 'weekly' && <label>Weekday (UTC)<select value={rule.weekday} onChange={(event) => update({ recurrence: { ...rule, weekday: Number(event.target.value) } })} className={field}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
      <label>Maximum dispatch attempts<input required type="number" min={1} max={100} step={1} value={value.maxRuns} onChange={(event) => update({ maxRuns: Number(event.target.value) })} className={field} /></label>
    </div>
    <p className="mt-3 leading-relaxed text-amber-100/80">Saved paused: Resume in Schedules authorizes recurring provider use and possible charges. Maximum 20 schedules, two scheduler missions at once, no overlap per schedule. Missed/busy slots are skipped, never replayed. Backend must stay running; restart requires Resume again. Pause does not cancel an active mission. Every run keeps mission budgets, tool grants, deadline and HUMAN/report approvals. Current backend settings and overrides apply at dispatch; no keys are stored here. Mission text is saved on disk: do not include secrets. UTC only, not local time or full cron syntax.</p>
  </fieldset>;
}