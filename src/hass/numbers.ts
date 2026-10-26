/** Clamp to min/max and snap to the step grid (anchored at min), without float noise */
export function clampToStep(value: number, min: number, max: number, step?: number): number {
	let v = Math.min(Math.max(value, min), max)
	if (step && step > 0) {
		const base = Number.isFinite(min) ? min : 0
		v = base + Math.round((v - base) / step) * step
		const decimals = (String(step).split('.')[1] ?? '').length
		v = Number(v.toFixed(decimals))
		if (v > max) v = Number((v - step).toFixed(decimals))
	}
	return v
}
