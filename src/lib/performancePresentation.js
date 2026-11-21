// Display-only projection of measured rows. Never average agent rates or percentiles.
export function summarizePerformance(rows) {
  const ai = rows.filter((row) => row.id !== 'HUMAN');
  const human = rows.find((row) => row.id === 'HUMAN');
  const totals = ai.reduce((result, row) => {
    for (const key of Object.keys(result)) result[key] += row[key];
    return result;
  }, { completed: 0, failed: 0, cancelled: 0, skipped: 0, duration_samples: 0, llm_calls: 0, responses: 0, request_errors: 0, reported_calls: 0, unreported_calls: 0, total_tokens: 0, tool_calls: 0, tool_errors: 0 });
  const decided = totals.completed + totals.failed;
  return { ...totals,
    completion_rate: decided ? totals.completed / decided : null,
    mean_ms: totals.duration_samples ? ai.reduce((sum, row) => sum + (row.mean_ms ?? 0) * row.duration_samples, 0) / totals.duration_samples : null,
    usage_coverage: totals.responses ? totals.reported_calls / totals.responses : null,
    human_samples: human?.duration_samples ?? 0,
    human_mean_ms: human?.mean_ms ?? null,
  };
}