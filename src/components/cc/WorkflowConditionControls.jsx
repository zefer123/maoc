import { CONDITION_OPERATORS } from '../../lib/workflowGraph.js';

const field = 'mt-1 w-full rounded border border-white/20 bg-slate-950 p-2';

export default function WorkflowConditionControls({ node, nodes, onChange }) {
  const sources = nodes.filter((source) => node.dependsOn.includes(source.id) && source.agent !== 'HUMAN');
  const when = node.when;
  const update = (patch) => onChange({ when: { ...when, ...patch } });
  const type = typeof when?.value;
  return <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
    <label className="block">Join dependencies
      <select aria-label={`Join ${node.id}`} value={node.join || 'all'} onChange={(event) => onChange({ join: event.target.value })} className={field}>
        <option value="all">All paths must complete</option><option value="any">Any completed path (merge IF/ELSE)</option>
      </select>
    </label>
    <label className="flex items-center gap-2"><input aria-label={`Conditional ${node.id}`} type="checkbox" checked={Boolean(when)} disabled={!when && (!sources.length || ['SAGE', 'LEX', 'CIPHER'].includes(node.agent))} onChange={(event) => onChange({ when: event.target.checked ? { source: sources[0].id, tool: 'agent-registry', path: 'agents.0.id', operator: 'eq', value: 'TAEC', branch: 'if' } : undefined })} />Run on tool-result condition</label>
    {when && <div className="grid gap-3 sm:grid-cols-2">
      <label>Source node<select aria-label={`Source ${node.id}`} className={field} value={when.source} onChange={(event) => update({ source: event.target.value })}><option value="">Choose direct AI dependency</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.id} · {source.agent}</option>)}</select></label>
      <label>Tool name<input aria-label={`Tool ${node.id}`} className={field} maxLength={64} value={when.tool} onChange={(event) => update({ tool: event.target.value })} /></label>
      <label>Result path<input aria-label={`Path ${node.id}`} className={field} maxLength={200} value={when.path} onChange={(event) => update({ path: event.target.value })} /></label>
      <label>Operator<select aria-label={`Operator ${node.id}`} className={field} value={when.operator} onChange={(event) => update({ operator: event.target.value })}>{CONDITION_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label>
      <label>Value type<select aria-label={`Value type ${node.id}`} className={field} value={type} onChange={(event) => update({ value: event.target.value === 'boolean' ? true : event.target.value === 'number' ? 0 : '' })}><option value="string">String (case-sensitive)</option><option value="number">Number</option><option value="boolean">Boolean</option></select></label>
      <label>Compare value{type === 'boolean' ? <select aria-label={`Value ${node.id}`} className={field} value={String(when.value)} onChange={(event) => update({ value: event.target.value === 'true' })}><option value="true">true</option><option value="false">false</option></select> : <input aria-label={`Value ${node.id}`} className={field} type={type === 'number' ? 'number' : 'text'} step={type === 'number' ? 'any' : undefined} maxLength={200} value={Number.isNaN(when.value) ? '' : when.value} onChange={(event) => update({ value: type === 'number' ? event.target.valueAsNumber : event.target.value })} />}</label>
      <label>Branch<select aria-label={`Branch ${node.id}`} className={field} value={when.branch} onChange={(event) => update({ branch: event.target.value })}><option value="if">IF — comparison is true</option><option value="else">ELSE — comparison is false</option></select></label>
    </div>}
  </div>;
}