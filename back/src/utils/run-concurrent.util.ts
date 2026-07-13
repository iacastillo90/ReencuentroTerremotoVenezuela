/**
 * utils/run-concurrent.util.ts — Ejecución concurrente con límite
 *
 * PROPÓSITO:
 *   Ejecuta una función async sobre un array de items con un límite
 *   de concurrencia configurable. Útil para operaciones que no deben
 *   saturar recursos (BD, API externa) pero quieren paralelismo.
 *
 * CARACTERÍSTICAS:
 *   - runConcurrent: Procesa items con N workers en paralelo
 *   - Mantiene orden de resultados (index-based)
 *   - Límite de concurrencia dinámico (min(concurrency, items.length))
 *
 * CÓMO USAR:
 *   const results = await runConcurrent(urls, 5, fetchUrl);
 *
 * @module run-concurrent.util
 */
export async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
