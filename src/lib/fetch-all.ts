/**
 * Paginated fetch helper to bypass PostgREST's default 1000-row cap.
 *
 * Usage:
 *   const rows = await fetchAll((from, to) =>
 *     supabase.from('invoices').select('...').range(from, to)
 *   );
 *
 * The builder callback MUST call `.range(from, to)` so each page is bounded.
 * Any `.select`, `.eq`, `.order`, `.or` filters can be chained inside the callback.
 */
export async function fetchAll<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  maxRows = 100000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (from < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
