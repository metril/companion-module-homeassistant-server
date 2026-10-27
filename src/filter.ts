import type { HassEntity } from 'home-assistant-js-websocket'
import type { DeviceConfig } from './config.js'
import type { EntityIndexEntry } from './hass/entityIndex.js'
import type { AreaEntry, DeviceEntry } from './hass/registries.js'

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
	/** Count after label/area/floor filters; only set when one is configured */
	afterTaxonomy?: number
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

export function perDomainCountsFromIds(ids: Iterable<string>): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const id of ids) {
		const domain = entityDomain(id)
		counts[domain] = (counts[domain] ?? 0) + 1
	}
	return counts
}

export function perDomainCountsFromState(state: HassEntity[]): Record<string, number> {
	return perDomainCountsFromIds(state.map((e) => e.entity_id))
}

export function computeFilterBreakdown(entityIds: string[], config: DeviceConfig): FilterBreakdown {
	const domainSet = new Set(config.include_domains ?? [])
	const includes = compileGlobList(config.include_patterns)
	const excludes = compileGlobList(config.exclude_patterns)

	const perDomainCounts: Record<string, number> = {}
	let afterDomains = 0
	let afterIncludes = 0
	let afterExcludes = 0

	for (const id of entityIds) {
		const domain = entityDomain(id)
		perDomainCounts[domain] = (perDomainCounts[domain] ?? 0) + 1

		if (domainSet.size > 0 && !domainSet.has(domain)) continue
		afterDomains++

		if (includes && !includes.test(id)) continue
		afterIncludes++

		if (excludes && excludes.test(id)) continue
		afterExcludes++
	}

	return {
		totalCount: entityIds.length,
		afterDomains: domainSet.size === 0 ? entityIds.length : afterDomains,
		afterIncludes: includes === null ? (domainSet.size === 0 ? entityIds.length : afterDomains) : afterIncludes,
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

export interface TaxonomySelection {
	labels: Set<string>
	areas: Set<string>
	floors: Set<string>
}

function taxonomyFromConfig(config: DeviceConfig, kind: 'include' | 'exclude'): TaxonomySelection {
	return {
		labels: new Set(config[`${kind}_labels`] ?? []),
		areas: new Set(config[`${kind}_areas`] ?? []),
		floors: new Set(config[`${kind}_floors`] ?? []),
	}
}

const taxonomyIsEmpty = (t: TaxonomySelection): boolean =>
	t.labels.size === 0 && t.areas.size === 0 && t.floors.size === 0

/** True if a label/area/floor include or exclude is configured (which requires the registries to resolve) */
export function hasTaxonomyFilter(config: DeviceConfig): boolean {
	return (
		!taxonomyIsEmpty(taxonomyFromConfig(config, 'include')) || !taxonomyIsEmpty(taxonomyFromConfig(config, 'exclude'))
	)
}

/** True if any filter layer is configured. If not, everything is subscribed (the legacy behaviour) */
export function hasAnyFilter(config: DeviceConfig): boolean {
	return (
		(config.include_domains?.length ?? 0) > 0 ||
		!!config.include_patterns?.trim() ||
		!!config.exclude_patterns?.trim() ||
		hasTaxonomyFilter(config)
	)
}

export interface FilterResolutionInput {
	/** Every entity id to consider (registered or not) */
	entityIds: Iterable<string>
	/** Registry entries by entity id (unregistered entities are absent) */
	registry: Map<string, EntityIndexEntry>
	/** Needed to inherit area/labels from a device. Optional: without it only the entity's own area/labels are used */
	devices?: Record<string, DeviceEntry>
	/** Needed to resolve floors */
	areas?: AreaEntry[]
}

/**
 * Resolve the filter to a set of entity ids using only the registries, without needing any entity state.
 * Layers combine with AND: domains, include globs, exclude globs, label/area/floor include (any of), label/area/floor exclude (any of).
 */
export function resolveFilteredIds(input: FilterResolutionInput, config: DeviceConfig): Set<string> {
	const base = compileFilter(config)
	const include = taxonomyFromConfig(config, 'include')
	const exclude = taxonomyFromConfig(config, 'exclude')
	const needTaxonomy = !taxonomyIsEmpty(include) || !taxonomyIsEmpty(exclude)

	const floorByArea = new Map<string, string | null | undefined>()
	for (const area of input.areas ?? []) floorByArea.set(area.area_id, area.floor_id)

	const matches = (id: string, sel: TaxonomySelection): boolean => {
		const entry = input.registry.get(id)
		if (!entry) return false // unregistered entities have no area/labels
		const device = entry.di ? input.devices?.[entry.di] : undefined

		if (sel.labels.size > 0) {
			for (const l of entry.lb ?? []) if (sel.labels.has(l)) return true
			for (const l of device?.labels ?? []) if (sel.labels.has(l)) return true
		}

		const areaId = entry.ai ?? device?.area_id
		if (areaId) {
			if (sel.areas.has(areaId)) return true
			const floorId = floorByArea.get(areaId)
			if (floorId && sel.floors.has(floorId)) return true
		}
		return false
	}

	const result = new Set<string>()
	for (const id of input.entityIds) {
		if (!base(id)) continue
		if (needTaxonomy) {
			if (!taxonomyIsEmpty(include) && !matches(id, include)) continue
			if (!taxonomyIsEmpty(exclude) && matches(id, exclude)) continue
		}
		result.add(id)
	}
	return result
}
