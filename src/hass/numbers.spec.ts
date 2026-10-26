import { describe, expect, it } from 'vitest'
import { clampToStep } from './numbers.js'

describe('clampToStep', () => {
	it('clamps to range', () => {
		expect(clampToStep(150, 0, 100)).toBe(100)
		expect(clampToStep(-5, 0, 100)).toBe(0)
	})
	it('snaps to step from min without float noise', () => {
		expect(clampToStep(20.3, 10, 30, 0.5)).toBe(20.5)
		expect(clampToStep(0.30000000000000004, 0, 1, 0.1)).toBe(0.3)
		expect(clampToStep(7, 0, 100, 5)).toBe(5)
	})
	it('copes with unbounded ranges', () => {
		expect(clampToStep(3.2, -Infinity, Infinity, 1)).toBe(3)
		expect(clampToStep(3.2, -Infinity, Infinity)).toBe(3.2)
	})
	it('never exceeds max after snapping', () => {
		expect(clampToStep(9.9, 0, 9, 2)).toBeLessThanOrEqual(9)
	})
})
