export interface PagedPage<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}

/**
 * Fetch every page of a cursor-paginated endpoint.
 * Stops on first page without has_more, or after maxPages guard.
 */
export async function paginateAll<T>(
  fetchPage: (cursor: string | undefined, limit: number) => Promise<PagedPage<T>>,
  limit = 100,
  maxPages = 50,
): Promise<T[]> {
  const acc: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(cursor, limit);
    acc.push(...result.items);
    if (!result.hasMore || !result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return acc;
}
