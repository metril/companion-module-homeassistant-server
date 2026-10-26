import { describe, expect, it } from 'vitest'
import { buildTarget, resolveReturnResponse } from './targets.js'

describe('buildTarget', () => {
	it('defaults to entities', () => {
		expect(buildTarget({ entity_id: ['light.a'] })).toEqual({ entity_id: ['light.a'] })
	})
	it('maps each type', () => {
		expect(buildTarget({ target_type: 'area', target_area: ['k'] })).toEqual({ area_id: ['k'] })
		expect(buildTarget({ target_type: 'floor', target_floor: ['f'] })).toEqual({ floor_id: ['f'] })
		expect(buildTarget({ target_type: 'label', target_label: ['l'] })).toEqual({ label_id: ['l'] })
		expect(buildTarget({ target_type: 'device', target_device: ['d'] })).toEqual({ device_id: ['d'] })
	})
	it('is empty without ids', () => {
		expect(buildTarget({ target_type: 'area', target_area: [] })).toEqual({})
	})
})

describe('resolveReturnResponse', () => {
	it('never sends without a response definition', () => {
		expect(resolveReturnResponse(undefined, true, '2024.1.0')).toBe(false)
	})
	it('always sends when the response is mandatory', () => {
		expect(resolveReturnResponse({ optional: false }, false, '2024.1.0')).toBe(true)
	})
	it('follows the user when optional', () => {
		expect(resolveReturnResponse({ optional: true }, true, '2024.1.0')).toBe(true)
		expect(resolveReturnResponse({ optional: true }, false, '2024.1.0')).toBe(false)
	})
	it('is gated on HA 2023.7', () => {
		expect(resolveReturnResponse({ optional: false }, true, '2023.6.3')).toBe(false)
		expect(resolveReturnResponse({ optional: false }, true, '2023.7.0')).toBe(true)
	})
})
