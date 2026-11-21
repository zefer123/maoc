export const STOP_LABELS = Object.freeze({
  LLM_CALL_FAILED: 'Logical LLM call ไม่คืนผลสำเร็จ; ยังยืนยัน root cause หรือ billing ไม่ได้',
  DEADLINE_EXCEEDED: 'Mission deadline หมดเวลา', SERVER_SHUTDOWN: 'Backend shutdown ขณะภารกิจยังไม่จบ',
  HUMAN_CANCELLED: 'ผู้ใช้ยกเลิกจาก HUMAN contribution', REPORT_REJECTED: 'ผู้ใช้ปฏิเสธรายงาน',
  CONDITION_UNAVAILABLE: 'ไม่มีผล tool ที่ใช้ประเมิน condition ได้', CONDITION_INVALID: 'ข้อมูล condition ไม่ผ่านการประเมินแบบ strict',
  FINAL_PATH_UNREACHABLE: 'ไม่มี active path ไปถึง final report', BUDGET_GUARD: 'หยุดด้วย token budget guard',
  LOOP_GUARD: 'หยุดด้วย loop/tool-call guard', HANDOFF_GUARD: 'หยุดด้วย handoff guard',
  PLANNING_FAILED: 'วางแผนลำดับงานไม่สำเร็จ', ARCHIVE_FAILED: 'การบันทึกผลงานไม่คืนผลสำเร็จ',
  EXECUTION_FAILED: 'Execution หยุดโดยยังไม่มีหมวดสาเหตุที่ละเอียดกว่านี้', WORKFLOW_FAILED: 'Workflow หยุดก่อนจบขั้นตอน',
});
export const REVIEW_PHASES = Object.freeze(['planning', 'execution', 'routing', 'handoff', 'human', 'review', 'archive', 'mission']);
export const SKIP_LABELS = Object.freeze({ NOT_SELECTED: 'Branch นี้ไม่ถูกเลือก', DEPENDENCY_SKIPPED: 'Dependency path ถูกข้าม', SOURCE_SKIPPED: 'Condition source ถูกข้าม' });

// Pure and deterministic. No model call, free-form error, actions, prose parsing or root-cause inference.
export function buildAfterActionReview(record) {
  const evidence = record.after_action || null;
  const totals = record.executions.reduce((result, execution) => {
    for (const key of Object.keys(result)) result[key] += execution[key]; return result;
  }, { llm_calls: 0, responses: 0, request_errors: 0, reported_calls: 0, unreported_calls: 0, total_tokens: 0, tool_calls: 0, tool_errors: 0 });
  const findings = []; const recommendations = [];
  const add = (id, refs, text) => findings.push({ id, evidence: refs, text });
  const recommend = (id, refs, text) => recommendations.push({ id, evidence: refs, text });
  add('mission-outcome', ['mission.state'], `ผลภารกิจที่ executor บันทึก: ${record.state} ไม่ใช่คะแนนคุณภาพหรือหลักฐานอนุญาต external actions`);
  if (evidence?.stop) {
    add('observed-stop', ['after_action.stop'], STOP_LABELS[evidence.stop.code]);
    recommend('inspect-stop', ['after_action.stop'], 'ตรวจขั้นตอนและบริบทใน local backend logs อย่างระมัดระวัง ไม่สรุป root cause จากรหัสหยุดงานเพียงอย่างเดียว และตรวจ side effects ก่อนตัดสินใจเริ่มภารกิจใหม่');
  }
  const failed = record.executions.filter((execution) => execution.state === 'FAILED');
  if (failed.length) add('failed-executions', failed.map((execution) => `execution:${execution.id}`), `พบ ${failed.length} execution ที่ล้มเหลว แยกจาก sibling ที่ถูกยกเลิกและ node ที่ไม่เคยเริ่ม`);
  const skipped = record.executions.filter((execution) => execution.state === 'SKIPPED');
  if (skipped.length) add('skipped-executions', skipped.map((execution) => `execution:${execution.id}`), `${skipped.length} execution ถูกข้าม ไม่มี provider calls หรือ latency sample ของขั้นตอนนั้น`);
  if (totals.request_errors || totals.unreported_calls) {
    add('usage-incomplete', ['totals.request_errors', 'totals.unreported_calls'], 'Usage ไม่ครบทุก logical call ตัวเลข tokens ไม่ใช่ billing totals และ unknown ไม่เท่ากับไม่มีค่าใช้จ่าย');
    recommend('check-usage', ['totals.reported_calls', 'totals.responses', 'totals.request_errors'], 'หากต้องตรวจค่าใช้จ่าย ให้ตรวจ usage/billing จาก provider แยกต่างหาก ห้ามประมาณยอดที่ขาดจากจำนวน calls');
  }
  if (totals.tool_errors) {
    add('tool-errors', ['totals.tool_errors'], `พบ ${totals.tool_errors} tool attempts ที่เกิด error แม้ Agent อาจส่ง deliverable สำเร็จในภายหลัง`);
    recommend('review-tools', ['totals.tool_errors'], 'ตรวจ inputs และสิทธิ์ tool ที่มีอยู่ก่อนเริ่มงานใหม่ ไม่เพิ่มสิทธิ์หรือ retry tools อัตโนมัติ');
  }
  if (evidence?.reviews.some((review) => review.status === 'REJECTED')) add('review-rejected', ['after_action.reviews'], 'มี report review ที่ถูกปฏิเสธ ขั้นตอน Agent ที่ทำเสร็จแล้วไม่ถูกเปลี่ยนเป็นล้มเหลวย้อนหลัง');
  if (evidence?.reviews.length || evidence?.human_waits.length) {
    add('recorded-waits', ['after_action.reviews', 'after_action.human_waits'], 'เวลารอ HUMAN และ report review เป็นช่วงเวลาที่วัดแยก; HUMAN wait รวมอยู่ใน HUMAN execution และช่วงเวลาขนานอาจทับกัน ห้ามบวกรวมเป็น critical path');
    recommend('review-waits', ['after_action.reviews', 'after_action.human_waits'], 'ทบทวนคำถามและขั้นตอนตรวจรายงานกับผู้ใช้งานเมื่อจำเป็น โดยรักษา report gates และ deadline เดิม');
  }
  const missing = [
    'ไม่มีคะแนนคุณภาพ ความถูกต้องของ deliverable หรือหลักฐาน consensus จากการรันสำเร็จเพียงอย่างเดียว',
    'ไม่เก็บ prompt/คำตอบ HUMAN/model prose/raw tool results/branch comparison values/ข้อความ error ดิบ จึงไม่ใช่ full mission archive',
    'ไม่มี HTTP retry/failover attempt ledger, provider billing reconciliation หรือการยืนยัน side effects ภายนอก',
    'ไม่กู้ active mission หลัง restart; forced termination ก่อน terminal commit อาจไม่มีรายงาน และ retention ไม่ใช่ประวัติครบตลอดอายุระบบ',
  ];
  if (!evidence) missing.unshift('Legacy analytics: มีเพียงตัวเลข execution ไม่มี topology, branch decisions, stop context หรือ report/HUMAN wait evidence ของ Phase 3.10; ไม่เติมข้อมูลย้อนหลัง');
  else if (record.state !== 'COMPLETED') missing.unshift('รหัสหยุดงานเป็นจุดที่ระบบสังเกตได้ ไม่ใช่การวิเคราะห์ root cause; node ที่ไม่ได้เริ่มไม่มี execution sample');
  if (!recommendations.length) recommend('review-evidence', ['mission.state', 'executions'], 'ตรวจ deliverable และหลักฐานต้นทางด้วยตนเองก่อนนำผลไปใช้ ไม่ถือว่า COMPLETED คือผ่านการตรวจคุณภาพหรืออนุญาต external actions');
  return { report_version: 1, generator: 'deterministic-evidence-v1', evidence_level: evidence ? 'recorded_context' : 'legacy_metrics_only',
    mission: { task_id: record.task_id, state: record.state, department: record.department, mode: record.mode, started_at: record.started_at,
      finished_at: record.finished_at, duration_ms: record.duration_ms }, totals,
    executions: structuredClone(record.executions), context: evidence ? structuredClone(evidence) : null, findings, missing, recommendations };
}