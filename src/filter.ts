import type { HassEntity } from 'home-assistant-js-websocket'
import type { DeviceConfig } from './config.js'

export type EntityFilter = (id: string) => boolean

export const COMMON_HA_DOMAINS: { id: string; label: string }[] = [
	{ id: 'ai_task', label: 'AI Task' },
	{ id: 'air_quality', label: 'Air Quality' },
	{ id: 'alarm_control_panel', label: 'Alarm Control Panel' },
	{ id: 'assist_satellite', label: 'Assist Satellite' },
	{ id: 'automation', label: 'Automation' },
	{ id: 'binary_sensor', label: 'Binary Sensor' },
	{ id: 'button', label: 'Button' },
	{ id: 'calendar', label: 'Calendar' },
	{ id: 'camera', label: 'Camera' },
	{ id: 'climate', label: 'Climate' },
	{ id: 'conversation', label: 'Conversation' },
	{ id: 'counter', label: 'Counter (helper)' },
	{ id: 'cover', label: 'Cover' },
	{ id: 'date', label: 'Date' },
	{ id: 'datetime', label: 'Date/Time' },
	{ id: 'device_tracker', label: 'Device Tracker' },
	{ id: 'event', label: 'Event' },
	{ id: 'fan', label: 'Fan' },
	{ id: 'geolocation', label: 'Geolocation' },
	{ id: 'group', label: 'Group' },
	{ id: 'humidifier', label: 'Humidifier' },
	{ id: 'image', label: 'Image' },
	{ id: 'image_processing', label: 'Image Processing' },
	{ id: 'infrared', label: 'Infrared' },
	{ id: 'input_boolean', label: 'Input Boolean (helper)' },
	{ id: 'input_button', label: 'Input Button (helper)' },
	{ id: 'input_datetime', label: 'Input Date/Time (helper)' },
	{ id: 'input_number', label: 'Input Number (helper)' },
	{ id: 'input_select', label: 'Input Select (helper)' },
	{ id: 'input_text', label: 'Input Text (helper)' },
	{ id: 'lawn_mower', label: 'Lawn Mower' },
	{ id: 'light', label: 'Light' },
	{ id: 'lock', label: 'Lock' },
	{ id: 'media_player', label: 'Media Player' },
	{ id: 'notify', label: 'Notify' },
	{ id: 'number', label: 'Number' },
	{ id: 'person', label: 'Person' },
	{ id: 'plant', label: 'Plant' },
	{ id: 'proximity', label: 'Proximity' },
	{ id: 'remote', label: 'Remote' },
	{ id: 'scene', label: 'Scene' },
	{ id: 'schedule', label: 'Schedule (helper)' },
	{ id: 'script', label: 'Script' },
	{ id: 'select', label: 'Select' },
	{ id: 'sensor', label: 'Sensor' },
	{ id: 'siren', label: 'Siren' },
	{ id: 'stt', label: 'Speech-to-Text' },
	{ id: 'sun', label: 'Sun' },
	{ id: 'switch', label: 'Switch' },
	{ id: 'tag', label: 'Tag (NFC)' },
	{ id: 'text', label: 'Text' },
	{ id: 'time', label: 'Time' },
	{ id: 'timer', label: 'Timer (helper)' },
	{ id: 'todo', label: 'To-do List' },
	{ id: 'tts', label: 'Text-to-Speech' },
	{ id: 'update', label: 'Update' },
	{ id: 'vacuum', label: 'Vacuum' },
	{ id: 'valve', label: 'Valve' },
	{ id: 'wake_word', label: 'Wake Word' },
	{ id: 'water_heater', label: 'Water Heater' },
	{ id: 'weather', label: 'Weather' },
	{ id: 'zone', label: 'Zone' },
]

export const DEFAULT_INCLUDED_DOMAINS = [
	'light',
	'switch',
	'media_player',
	'scene',
	'script',
	'button',
	'input_boolean',
	'input_button',
	'input_select',
	'input_number',
	'select',
	'number',
	'group',
	'climate',
	'cover',
	'fan',
	'lock',
]

export type FilterBreakdown = {
	totalCount: number
	afterDomains: number
	afterIncludes: number
	afterExcludes: number
	perDomainCounts: Record<string, number>
}

export function entityDomain(entityId: string): string {
	const dot = entityId.indexOf('.')
	return dot === -1 ? entityId : entityId.slice(0, dot)
}

function globToRegex(glob: string): string {
	return glob
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*/g, '.*')
		.replace(/\?/g, '.')
}

function compileGlobList(patterns: string | undefined): RegExp | null {
	if (!patterns) return null
	const tokens = patterns
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean)
	if (tokens.length === 0) return null
	const body = tokens.map(globToRegex).join('|')
	return new RegExp(`^(?:${body})$`)
}

export function compileFilter(config: DeviceConfig): EntityFilter {
	const domainSet = new Set(config.include_domains ?? [])
	const includes = compileGlobList(config.include_patterns)
	const excludes = compileGlobList(config.exclude_patterns)

	return (id) => {
		if (domainSet.size > 0) {
			if (!domainSet.has(entityDomain(id))) return false
		}
		if (includes && !includes.test(id)) return false
		if (excludes && excludes.test(id)) return false
		return true
	}
}

export function perDomainCountsFromState(state: HassEntity[]): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const entity of state) {
		const domain = entityDomain(entity.entity_id)
		counts[domain] = (counts[domain] ?? 0) + 1
	}
	return counts
}

export function computeFilterBreakdown(state: HassEntity[], config: DeviceConfig): FilterBreakdown {
	const domainSet = new Set(config.include_domains ?? [])
	const includes = compileGlobList(config.include_patterns)
	const excludes = compileGlobList(config.exclude_patterns)

	const perDomainCounts: Record<string, number> = {}
	let afterDomains = 0
	let afterIncludes = 0
	let afterExcludes = 0

	for (const entity of state) {
		const domain = entityDomain(entity.entity_id)
		perDomainCounts[domain] = (perDomainCounts[domain] ?? 0) + 1

		if (domainSet.size > 0 && !domainSet.has(domain)) continue
		afterDomains++

		if (includes && !includes.test(entity.entity_id)) continue
		afterIncludes++

		if (excludes && excludes.test(entity.entity_id)) continue
		afterExcludes++
	}

	return {
		totalCount: state.length,
		afterDomains: domainSet.size === 0 ? state.length : afterDomains,
		afterIncludes: includes === null ? (domainSet.size === 0 ? state.length : afterDomains) : afterIncludes,
		afterExcludes,
		perDomainCounts,
	}
}

export function allObservedDomains(state: HassEntity[]): string[] {
	const known = new Set(COMMON_HA_DOMAINS.map((d) => d.id))
	for (const entity of state) {
		known.add(entityDomain(entity.entity_id))
	}
	return Array.from(known).sort()
}
