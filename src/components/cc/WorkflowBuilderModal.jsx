import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS } from '../../data/agents.js';
import { createWorkflowExample, createHumanWorkflowExample, createConditionalWorkflowExample, validateWorkflow, workflowLayers } from '../../lib/workflowGraph.js';
import WorkflowConditionControls from './WorkflowConditionControls.jsx';
import { compileSwarm, createSwarmExample } from '../../lib/swarmGraph.js';
import SwarmControls from './SwarmControls.jsx';
import ScheduleControls from './ScheduleControls.jsx';
import { validateSchedule } from '../../lib/schedule.js';
import TaskTemplateControls from './TaskTemplateControls.jsx';
import { TabBar } from './DashboardPanels.jsx';
import CeoDirectivePanel from './CeoDirectivePanel.jsx';

export default function WorkflowBuilderModal({ open, onClose, onDispatch, onSchedule, connectionState, entryTab = 'goal', directive, onDirective, onCheckMissions }) {
  const [workflow, setWorkflow] = useState(createWorkflowExample);
  const [mode, setMode] = useState('sequential');
  const [step, setStep] = useState('goal');
  const [swarm, setSwarm] = useState(createSwarmExample);
  const [description, setDescription] = useState('[TEAM:TECH] Research and review an implementation plan. Produce a final evidence-based report.');
  const [submitting, setSubmitting] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [timing, setTiming] = useState('now');
  const [schedule, setSchedule] = useState({ name: 'Recurring mission', recurrence: { kind: 'interval', minutes: 60 }, maxRuns: 10 });
  const [submitError, setSubmitError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { if (open) setStep(entryTab); }, [open, entryTab]);
  const validation = useMemo(() => {
    try {
      if (mode === 'sequential') return { sequential: true };
      if (mode === 'swarm') { const compiled = compileSwarm(swarm); return { graph: compiled.workflow, swarm: compiled.swarm }; }
      return { graph: validateWorkflow(workflow) };
    }
    catch (error) { return { error: error.message }; }
  }, [workflow, mode, swarm]);
  const mission = useMemo(() => ({ description, ...(mode === 'swarm' ? { swarm: validation.swarm } : mode === 'dag' ? { workflow: validation.graph } : {}) }), [description, mode, validation]);
  const positions = useMemo(() => {
    if (!validation.graph) return new Map();
    return new Map(workflowLayers(validation.graph).flatMap((layer, x) => layer.map((node, y) => [node.id, { x: x * 190 + 12, y: y * 70 + 12 }])));
  }, [validation]);
  const scheduleValidation = useMemo(() => {
    if (timing !== 'recurring') return {};
    try { return { config: validateSchedule({ ...schedule, ...mission }) }; }
    catch (error) { return { error: error.message }; }
  }, [timing, schedule, mission]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && [first, dialog.current].includes(document.activeElement)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const update = (id, patch) => setWorkflow((prev) => ({ ...prev, nodes: prev.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) }));
  const remove = (id) => setWorkflow((prev) => ({ ...prev, nodes: prev.nodes.filter((node) => node.id !== id).map((node) => ({ ...node, dependsOn: node.dependsOn.filter((parent) => parent !== id) })) }));
  const width = Math.max(400, ...[...positions.values()].map(({ x }) => x + 178));
  const height = Math.max(100, ...[...positions.values()].map(({ y }) => y + 64));
  const button = 'rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40';
  return (
    <div className="dash-builder-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="workflow-title" className="dash-builder flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950 text-slate-200 shadow-glow-cyan">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 id="workflow-title" className="font-mono text-sm font-bold tracking-wider text-cyan-200">{directive ? 'CEO Quick Directive — สั่งงานผ่าน ARIA' : 'สร้างภารกิจ // MISSION BUILDER'}</h2>
          <button type="button" onClick={onClose} className={button}>Close</button>
        </header>
        {directive ? <CeoDirectivePanel teamId={directive.teamId} initialText={directive.text} connectionState={connectionState} onDispatch={onDirective} onCheckMissions={onCheckMissions} /> : <form noValidate className="space-y-4 overflow-y-auto p-4" onSubmit={async (event) => {
          event.preventDefault();
          if (step !== 'review') return;
          if (!description.trim() || description.length > 12000 || connectionState !== 'live') return;
          if ((!validation.graph && !validation.sequential) || submitting || templateBusy) return;
          if (timing === 'recurring' && !scheduleValidation.config) return;
          if (!window.confirm(timing === 'recurring' ? 'บันทึก schedule แบบ paused? ยังไม่เริ่มงานจนกว่าจะ Resume' : 'เริ่มภารกิจด้วยการตั้งค่านี้? อาจมีค่าใช้จ่าย provider โดยยังคง HUMAN/report approval และ guardrails เดิม')) return;
          setSubmitting(true);
          setSubmitError('');
          try {
            const accepted = timing === 'recurring' ? await onSchedule(scheduleValidation.config) : await onDispatch(mission.description, mission.workflow, mission.swarm);
            if (accepted) onClose();
          } catch (error) { setSubmitError(error.message); }
          finally { setSubmitting(false); }
        }}>
          <TabBar label="builder-steps" value={step} onChange={setStep} items={[{ id: 'goal', label: '1 · เป้าหมาย' }, { id: 'method', label: '2 · วิธีทำงาน' }, { id: 'timing', label: '3 · เวลา' }, { id: 'review', label: '4 · ทบทวน' }, { id: 'templates', label: 'Templates' }]} />
          <div hidden={step !== 'templates'} className="builder-step">
          <p className="mb-4 text-xs leading-relaxed text-slate-400">เลือกแม่แบบและเติมพารามิเตอร์ก่อนนำเข้า draft การโหลดไม่เรียก AI และรีเซ็ตเวลาเป็น Run now เสมอ ตรวจทานใหม่ก่อนเริ่มงาน</p>
          <TaskTemplateControls mission={validation.error ? { description: '' } : mission} connectionState={connectionState} disabled={submitting} onBusyChange={setTemplateBusy} onApply={(expanded) => {
            setDescription(expanded.description);
            if (expanded.swarm) { setSwarm(expanded.swarm); setMode('swarm'); }
            else if (expanded.workflow) { setWorkflow(expanded.workflow); setMode('dag'); }
            else setMode('sequential');
            setTiming('now'); setSubmitError(''); setStep('goal');
          }} />
          </div>
          <div hidden={step !== 'goal'} className="builder-step">
            <p className="mb-4 text-xs leading-relaxed text-slate-400">ระบุสิ่งที่ต้องการ ผลลัพธ์ และข้อจำกัดให้ชัด ใช้ [TEAM:TECH] หรือแผนกอื่นหากต้องการ routing แบบเจาะจง อย่าใส่รหัสผ่านหรือ API key</p>
            <label className="block text-xs">Mission
              <textarea required maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-40 w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-sm leading-relaxed" />
            </label>
            <button type="button" className={`${button} mt-4`} onClick={() => setStep('templates')}>ใช้แม่แบบ / Templates</button>
          </div>
          <div hidden={step !== 'timing'} className="builder-step space-y-4">
            <label className="block text-xs">Dispatch timing <select value={timing} onChange={(event) => setTiming(event.target.value)} className="ml-2 rounded border border-white/20 bg-slate-950 p-2"><option value="now">Run now</option><option value="recurring">Recurring schedule</option></select></label>
            {timing === 'recurring' && <ScheduleControls value={schedule} onChange={setSchedule} />}
            <p className="text-xs leading-relaxed text-slate-400">Schedule ใหม่เริ่ม paused เสมอ ใช้ UTC เท่านั้น และยังต้องการคำตอบ HUMAN/การตรวจรายงาน ไม่มี catch-up หรือ retry อัตโนมัติ</p>
          </div>
          <div hidden={step !== 'method'} className="builder-step space-y-4">
          <label className="block text-xs">Execution mode <select value={mode} onChange={(event) => setMode(event.target.value)} className="ml-2 rounded border border-white/20 bg-slate-950 p-2"><option value="dag">Custom DAG</option><option value="swarm">Swarm Mode</option><option value="sequential">Sequential (existing router)</option></select></label>
          <p className="text-xs leading-relaxed text-slate-400">เริ่มด้วย Sequential สำหรับงานทั่วไป · DAG ให้กำหนด dependencies · Swarm วิเคราะห์อิสระแล้วสรุปหนึ่งรอบ ไม่รับประกันฉันทามติ คำถาม HUMAN อยู่ที่ กิจกรรม → ต้องดำเนินการ; deadline ยังเดิน SAGE / LEX / CIPHER ตรวจรายงานแยกต่างหาก ไม่อนุญาต live orders หรือ shell</p>
          {mode === 'swarm' ? <SwarmControls swarm={swarm} onChange={setSwarm} /> : mode === 'dag' ? <div className="flex flex-wrap gap-2">
            <label className="text-xs">Max parallel nodes <select value={workflow.maxConcurrency} onChange={(event) => setWorkflow((prev) => ({ ...prev, maxConcurrency: Number(event.target.value) }))} className="ml-2 rounded border border-white/20 bg-slate-900 p-2">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
            <button type="button" className={button} disabled={workflow.nodes.length >= 16} onClick={() => setWorkflow((prev) => ({ ...prev, nodes: [...prev.nodes, { id: `n${crypto.randomUUID().slice(0, 8)}`, agent: 'ARIA', dependsOn: [] }] }))}>+ Add node</button>
            <button type="button" className={button} onClick={() => setWorkflow(createWorkflowExample())}>Reset example</button>
            <button type="button" className={button} onClick={() => setWorkflow(createHumanWorkflowExample())}>Human collaboration example</button>
            <button type="button" className={button} onClick={() => { setWorkflow(createConditionalWorkflowExample()); setDescription('[TEAM:TECH] Inspect the actual agent-registry tool result. Call agent-registry before reporting. Selected branch: review implementation constraints and produce an evidence-based final report.'); }}>Conditional branching example</button>
          </div> : <p className="text-xs text-slate-400">Sequential mode uses the existing department/COWORK router. DAG messaging is unavailable; normal budgets, tools and HITL apply.</p>}
          {mode === 'dag' && <label className="block rounded-lg border border-purple-400/30 bg-purple-500/10 p-3 text-xs leading-relaxed text-purple-200">
            <input type="checkbox" checked={workflow.messaging === true} onChange={(event) => setWorkflow((prev) => ({ ...prev, messaging: event.target.checked }))} className="mr-2" />
            Enable direct agent messages
            <span className="mt-1 block text-slate-400">Optional AI-to-AI reference mail to pending nodes in later dependency layers only. No replies, wakeups or extra permissions. Up to 2000 characters/message, 4/sender, 6/recipient, 24/task; messages share the handoff allowance with all DAG edges. Text is visible in Chronicle, archived and may be sent to providers. Do not include secrets. Swarm messaging stays disabled.</span>
          </label>}
          {mode === 'dag' && <p className="rounded-lg border border-amber-400/25 p-3 text-xs leading-relaxed text-amber-100/80">Conditional routing reads the last actual tool result from a direct AI dependency. Use the same comparison with IF and ELSE for opposite paths; join them with “Any completed path”. Missing/error/type-mismatched results stop the mission, never select ELSE by guesswork. No expressions or new tool permissions. Skipped paths do not call providers or request HUMAN input. Review agents must remain before branching. All layers still drain before joins; tool side effects already performed cannot be undone. Condition values are saved verbatim in templates/schedules/artifacts: do not include secrets.</p>}
          {validation.error ? <p role="alert" className="rounded border border-amber-400/40 p-3 text-xs text-amber-200">{validation.error}</p> : validation.graph ? (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-2">
              <svg role="img" aria-label={mode === 'swarm' ? 'Swarm dependency graph; all selected analysts feed the synthesis node' : 'Workflow dependency graph; full editable dependencies follow below'} width={width} height={height} className="mx-auto">
                <defs><marker id="workflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" /></marker></defs>
                {validation.graph.nodes.flatMap((node) => node.dependsOn.map((parent) => {
                  const from = positions.get(parent); const to = positions.get(node.id);
                  return <path key={`${parent}-${node.id}`} d={`M ${from.x + 160} ${from.y + 24} C ${from.x + 175} ${from.y + 24}, ${to.x - 15} ${to.y + 24}, ${to.x} ${to.y + 24}`} fill="none" stroke={node.when ? '#c084fc' : '#22d3ee'} strokeDasharray={node.when ? '5 3' : undefined} markerEnd="url(#workflow-arrow)" />;
                }))}
                {validation.graph.nodes.map((node) => {
                  const { x, y } = positions.get(node.id);
                  return <g key={node.id}><rect x={x} y={y} width="160" height="48" rx="8" fill="#0f172a" stroke="#22d3ee" /><text x={x + 10} y={y + 19} fill="#a5f3fc" fontSize="12">{node.agent}{node.when ? ` · ${node.when.branch.toUpperCase()}` : node.join === 'any' ? ' · MERGE' : ''}</text><text x={x + 10} y={y + 36} fill="#94a3b8" fontSize="10">{node.id}</text></g>;
                })}
              </svg>
            </div>
          ) : null}
          {mode === 'dag' && <div className="grid gap-3 md:grid-cols-2">
            {workflow.nodes.map((node) => (
              <fieldset key={node.id} className="rounded-xl border border-white/15 bg-slate-900/60 p-3 text-xs">
                <legend className="px-1 font-mono text-cyan-200">{node.id}</legend>
                <div className="flex items-center justify-between gap-2">
                  <label>Participant <select className="ml-2 rounded border border-white/20 bg-slate-950 p-2" value={node.agent} onChange={(event) => {
                    const agent = event.target.value;
                    setWorkflow((prev) => ({ ...prev, nodes: prev.nodes.map((current) => current.id !== node.id ? current : {
                      id: current.id, agent, dependsOn: current.dependsOn,
                      ...(current.when ? { when: current.when } : {}), ...(current.join ? { join: current.join } : {}),
                      ...(agent === 'HUMAN' ? { prompt: current.prompt || 'What requirements or corrections should the next step use?' } : {})
                    }) }));
                  }}><option value="HUMAN">HUMAN — your input</option>{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{agent.id}</option>)}</select></label>
                  <button type="button" aria-label={`Remove ${node.id}`} onClick={() => remove(node.id)} className="text-red-300 hover:underline">Remove</button>
                </div>
                {node.agent === 'HUMAN' && <label className="mt-3 block">Question for human (no secrets)<textarea required maxLength={2000} value={node.prompt || ''} onChange={(event) => update(node.id, { prompt: event.target.value })} className="mt-1 min-h-16 w-full rounded border border-amber-400/30 bg-slate-950 p-2" /></label>}
                <p className="mb-1 mt-3 text-slate-400">Depends on (check to connect)</p>
                <div className="flex flex-wrap gap-3">
                  {workflow.nodes.filter((other) => other.id !== node.id).map((other) => <label key={other.id} className="flex items-center gap-1"><input type="checkbox" checked={node.dependsOn.includes(other.id)} onChange={(event) => update(node.id, { dependsOn: event.target.checked ? [...node.dependsOn, other.id] : node.dependsOn.filter((id) => id !== other.id) })} />{other.id}</label>)}
                </div>
                <WorkflowConditionControls node={node} nodes={workflow.nodes} onChange={(patch) => update(node.id, patch)} />
              </fieldset>
            ))}
          </div>}
          </div>
          <div hidden={step !== 'review'} className="builder-step space-y-4">
            <h3 className="text-sm font-semibold text-cyan-200">ตรวจทานก่อนยืนยัน</h3>
            <p className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-slate-900 p-4 text-sm leading-relaxed">{description || 'ยังไม่ได้ระบุเป้าหมาย'}</p>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 p-4 text-xs"><dt className="text-slate-400">Execution</dt><dd>{mode === 'dag' ? 'Custom DAG' : mode === 'swarm' ? 'Swarm' : 'Sequential'}</dd><dt className="text-slate-400">Timing</dt><dd>{timing === 'recurring' ? 'Save paused schedule · UTC' : 'Run now'}</dd><dt className="text-slate-400">Nodes</dt><dd>{validation.graph?.nodes.length || 'Existing department router'}</dd></dl>
            {validation.graph?.nodes.some((node) => node.when) && <ul aria-label="Conditional routing review" className="space-y-2 text-xs text-purple-200">{validation.graph.nodes.map((node) => <li key={node.id} className="break-words">{node.id}: {node.when ? `${node.when.branch.toUpperCase()} ${node.when.source} / ${node.when.tool}.${node.when.path} ${node.when.operator} ${JSON.stringify(node.when.value)}` : 'Unconditional'} · join {node.join || 'all'}</li>)}</ul>}
            {validation.error && <p role="alert" className="text-sm text-amber-200">{validation.error} — กลับไปแก้ในวิธีทำงาน</p>}
            {scheduleValidation.error && <p role="alert" className="text-sm text-amber-200">{scheduleValidation.error} — กลับไปแก้ในเวลา</p>}
            {connectionState !== 'live' && <p role="alert" className="text-sm text-amber-200">เชื่อมต่อ backend ก่อนส่งภารกิจ</p>}
            <p className="text-xs leading-relaxed text-slate-400">Provider RPM, token budgets, tool permissions และ report approval ยังใช้ค่าเดิม ไม่ใช่ hard billing cap คำตอบและ artifact อาจส่งให้ provider ที่ตั้งค่าไว้</p>
          </div>
          {submitError && <p role="alert" className="text-sm text-red-300">{submitError}</p>}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <p className="text-xs text-slate-400">Only explicitly saved templates/schedules persist; this draft and parameter inputs do not survive reload. Provider RPM and mission budgets still apply.</p>
            <div className="flex w-full flex-wrap justify-between gap-2"><button type="button" className={button} disabled={submitting || templateBusy || step === 'goal'} onClick={() => setStep(({ method: 'goal', timing: 'method', review: 'timing', templates: 'goal' })[step])}>ย้อนกลับ</button>
            {step === 'review' ? <button type="submit" className={button} disabled={(!validation.graph && !validation.sequential) || !description.trim() || Boolean(scheduleValidation.error) || connectionState !== 'live' || submitting || templateBusy}>{submitting ? 'Sending…' : timing === 'recurring' ? 'Save paused schedule' : mode === 'swarm' ? 'Dispatch swarm' : mode === 'sequential' ? 'Dispatch sequential mission' : 'Dispatch workflow'}</button> : <button type="button" className={button} disabled={!description.trim() || submitting || templateBusy} onClick={() => setStep(({ goal: 'method', method: 'timing', timing: 'review', templates: 'goal' })[step])}>ถัดไป</button>}</div>
          </footer>
        </form>}
      </section>
    </div>
  );
}