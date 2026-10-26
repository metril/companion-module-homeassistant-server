import type { HassServiceTarget } from 'home-assistant-js-websocket'
import { atLeastHaVersion } from 'home-assistant-js-websocket/dist/util.js'

const toArray = (v: unknown): string[] =>
	Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === 'string' && v ? [v] : []

/** Build a HA service target from the TargetPicker options. A missing target_type means entity (legacy actions). */
export function buildTarget(options: Record<string, unknown>): HassServiceTarget {
	const type = (options.target_type as string | undefined) ?? 'entity'
	const ids = toArray(options[type === 'entity' ? 'entity_id' : `target_${type}`])
	if (ids.length === 0) return {}
	switch (type) {
		case 'area':
			return { area_id: ids }
		case 'floor':
			return { floor_id: ids }
		case 'label':
			return { label_id: ids }
		case 'device':
			return { device_id: ids }
		default:
			return { entity_id: ids }
	}
}

/**
 * Decide whether to send return_response.
 * No `response` in the service description: never. Not optional: always. Optional: only if the user asked.
 * Needs HA 2023.7+.
 */
export function resolveReturnResponse(
	response: { optional?: boolean } | undefined,
	userChoice: boolean,
	haVersion: string | undefined,
): boolean {
	if (!response) return false
	if (!haVersion || !atLeastHaVersion(haVersion, 2023, 7, 0)) return false
	if (response.optional === false) return true
	return userChoice
}
