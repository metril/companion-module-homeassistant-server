import { describe, expect, it } from 'vitest'
import { compareValues, readValue } from './compare.js'

describe('compareValues', () => {
	it('compares numerically when both sides are numbers', () => {
		expect(compareValues('10', 'gt', '9')).toBe(true)
		expect(compareValues(5, 'gte', '5')).toBe(true)
		expect(compareValues(5, 'lt', 5)).toBe(false)
		expect(compareValues('4.5', 'lte', '4.5')).toBe(true)
		expect(compareValues('1.0', 'eq', '1')).toBe(true)
	})
	it('does not order non-numbers', () => {
		expect(compareValues('abc', 'gt', '1')).toBe(false)
		expect(compareValues('unavailable', 'lt', '1')).toBe(false)
	})
	it('handles eq/ne as text otherwise', () => {
		expect(compareValues('on', 'eq', 'on')).toBe(true)
		expect(compareValues('on', 'ne', 'off')).toBe(true)
		expect(compareValues(undefined, 'eq', '')).toBe(true)
	})
	it('handles contains and regex', () => {
		expect(compareValues('Living room', 'contains', 'room')).toBe(true)
		expect(compareValues('abc123', 'regex', '^abc\\d+$')).toBe(true)
		expect(compareValues('abc', 'regex', '(')).toBe(false)
	})
})

describe('readValue', () => {
	const entity = { state: 'on', attributes: { brightness: 12 } }
	it('reads state or attribute', () => {
		expect(readValue(entity, '')).toBe('on')
		expect(readValue(entity, 'brightness')).toBe(12)
		expect(readValue(undefined, '')).toBeUndefined()
	})
})
