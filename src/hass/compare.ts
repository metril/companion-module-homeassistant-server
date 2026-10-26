import type { Comparison } from '../choices.js'

/** Resolve an entity's state (blank attribute) or one of its attributes */
export function readValue(
	entity: { state: string; attributes: Record<string, unknown> } | undefined,
	attribute: string | undefined,
): unknown {
	if (!entity) return undefined
	return attribute ? entity.attributes[attribute] : entity.state
}

function asNumber(v: unknown): number | undefined {
	if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
	if (typeof v === 'string' && v.trim() !== '') {
		const n = Number(v)
		return Number.isFinite(n) ? n : undefined
	}
	return undefined
}

const asText = (v: unknown): string =>
	typeof v === 'string'
		? v
		: v === undefined || v === null
			? ''
			: typeof v === 'object'
				? JSON.stringify(v)
				: `${v as string | number | boolean}`

/** Compare an entity value against the user supplied one. Ordering comparisons are numeric and false for non-numbers. */
export function compareValues(actual: unknown, comparison: Comparison, expected: unknown): boolean {
	const an = asNumber(actual)
	const en = asNumber(expected)

	switch (comparison) {
		case 'eq':
			return an !== undefined && en !== undefined ? an === en : asText(actual) === asText(expected)
		case 'ne':
			return !compareValues(actual, 'eq', expected)
		case 'gt':
			return an !== undefined && en !== undefined && an > en
		case 'gte':
			return an !== undefined && en !== undefined && an >= en
		case 'lt':
			return an !== undefined && en !== undefined && an < en
		case 'lte':
			return an !== undefined && en !== undefined && an <= en
		case 'contains':
			return asText(actual).includes(asText(expected))
		case 'regex':
			try {
				return new RegExp(asText(expected)).test(asText(actual))
			} catch {
				return false
			}
		default:
			return false
	}
}
