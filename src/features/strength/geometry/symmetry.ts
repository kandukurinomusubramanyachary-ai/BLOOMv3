/** Relative absolute difference [0, 1] for nonnegative measurements. Zero means
 * equal. Two zero measurements are equal; malformed/negative values return null.
 */
export function symmetry(left: number | null | undefined, right: number | null | undefined): number | null {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < 0) return null;
  const scale = Math.max(left, right);
  return scale === 0 ? 0 : Math.abs(left / scale - right / scale);
}
