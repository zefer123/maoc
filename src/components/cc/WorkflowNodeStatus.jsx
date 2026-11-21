export default function WorkflowNodeStatus({ node }) {
  return <div className="max-w-full space-y-1 break-words text-xs text-slate-400">
    {node.when && <p className="text-purple-200">{node.when.branch.toUpperCase()} {node.when.source} / {node.when.tool}.{node.when.path} {node.when.operator} {JSON.stringify(node.when.value)} · {node.condition_result === undefined ? 'ยังไม่ประเมิน' : node.condition_result ? 'เลือกเส้นทางนี้' : 'ไม่เลือกเส้นทางนี้'}</p>}
    {node.join === 'any' && <p>MERGE · รอทุก dependency จบ แล้วรับทางที่สำเร็จอย่างน้อยหนึ่งทาง</p>}
    {(node.skip_reason || node.failure_reason) && <p>{node.skip_reason || node.failure_reason}</p>}
  </div>;
}