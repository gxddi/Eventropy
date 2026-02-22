/**
 * Format a due date string for display so it matches the calendar date the user picked.
 * Uses the date part only (YYYY-MM-DD) to avoid timezone shifts when the value
 * comes back from the DB as ISO (e.g. 2025-03-15T00:00:00.000Z).
 */
export function formatDueDateDisplay(dueDate: string): string {
  const ymd = dueDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return dueDate;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

/**
 * Parse due date as local calendar date and return days until that date.
 * Negative = overdue. Uses date part only to match formatDueDateDisplay.
 */
export function getDaysUntilDue(dueDate: string): number {
  const ymd = dueDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 0;
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
