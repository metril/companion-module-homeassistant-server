import { describe, expect, it } from 'vitest'
import { hasAnyFilter, resolveFilteredIds } from './filter.js'
import type { EntityIndexEntry } from './hass/entityIndex.js'

const entry = (ei: string, extra: Partial<EntityIndexEntry> = {}): [string, EntityIndexEntry] => [ei, { ei, ...extra }]

const registry = new Map<string, EntityIndexEntry>([
	entry('light.kitchen', { ai: 'kitchen', lb: ['companion'] }),
	entry('light.hall', { di: 'dev1' }),
	entry('switch.lamp', { ai: 'bedroom' }),
	entry('sensor.temp', { ai: 'kitchen' }),
])
const input = {
	// light.yaml has no registry entry
	entityIds: [...registry.keys(), 'light.yaml'],
	registry,
	devices: { dev1: { id: 'dev1', area_id: 'hall_area', labels: ['companion'] } },
	areas: [
		{ area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground' },
		{ area_id: 'bedroom', name: 'Bedroom', floor_id: 'upper' },
		{ area_id: 'hall_area', name: 'Hall', floor_id: 'ground' },
	],
}

const resolve = (config: object) => Array.from(resolveFilteredIds(input, config)).sort()

describe('resolveFilteredIds', () => {
	it('keeps everything with an empty filter', () => {
		expect(resolve({})).toHaveLength(5)
	})

	it('applies domains and globs', () => {
		expect(resolve({ include_domains: ['light'] })).toEqual(['light.hall', 'light.kitchen', 'light.yaml'])
		expect(resolve({ include_domains: ['light'], exclude_patterns: '*yaml' })).toEqual(['light.hall', 'light.kitchen'])
	})

	it('includes by label, inheriting device labels', () => {
		expect(resolve({ include_labels: ['companion'] })).toEqual(['light.hall', 'light.kitchen'])
	})

	it('includes by area and floor, inheriting the device area', () => {
		expect(resolve({ include_areas: ['bedroom'] })).toEqual(['switch.lamp'])
		expect(resolve({ include_floors: ['ground'] })).toEqual(['light.hall', 'light.kitchen', 'sensor.temp'])
	})

	it('excludes by area, keeping unregistered entities', () => {
		expect(resolve({ exclude_areas: ['kitchen'] })).toEqual(['light.hall', 'light.yaml', 'switch.lamp'])
	})

	it('combines layers with AND', () => {
		expect(resolve({ include_floors: ['ground'], include_domains: ['sensor'] })).toEqual(['sensor.temp'])
	})
})

describe('hasAnyFilter', () => {
	it('is false for an empty config', () => {
		expect(hasAnyFilter({})).toBe(false)
		expect(hasAnyFilter({ include_domains: [], include_patterns: '', include_labels: [] })).toBe(false)
	})
	it('is true when any layer is set', () => {
		expect(hasAnyFilter({ exclude_areas: ['a'] })).toBe(true)
		expect(hasAnyFilter({ include_domains: ['light'] })).toBe(true)
	})
})
