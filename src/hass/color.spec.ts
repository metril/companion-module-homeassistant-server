import { describe, expect, it } from 'vitest'
import { kelvinToRgb, lightColorNumber, numberToRgb, rgbToNumber, validateColorMode } from './color.js'

describe('validateColorMode', () => {
	it('requires color_temp for kelvin', () => {
		expect(() => validateColorMode('kelvin', ['color_temp', 'hs'])).not.toThrow()
		expect(() => validateColorMode('kelvin', ['rgb'])).toThrow(/colour temperature/)
	})
	it('accepts any colour mode for rgb and hs', () => {
		for (const m of ['hs', 'xy', 'rgb', 'rgbw', 'rgbww']) {
			expect(() => validateColorMode('rgb', [m])).not.toThrow()
			expect(() => validateColorMode('hs', [m])).not.toThrow()
		}
		expect(() => validateColorMode('rgb', ['brightness'])).toThrow()
		expect(() => validateColorMode('hs', undefined)).toThrow()
	})
})

describe('colour helpers', () => {
	it('round trips rgb numbers', () => {
		expect(numberToRgb(rgbToNumber([1, 2, 3]))).toEqual([1, 2, 3])
	})
	it('approximates kelvin', () => {
		expect(kelvinToRgb(6600)).toEqual([255, 255, 255])
		const warm = kelvinToRgb(2700)
		expect(warm[0]).toBe(255)
		expect(warm[2]).toBeLessThan(warm[0])
	})
	it('prefers rgb_color, falls back to kelvin, none when off', () => {
		expect(lightColorNumber({ state: 'on', attributes: { rgb_color: [255, 0, 0] } })).toBe(0xff0000)
		expect(lightColorNumber({ state: 'on', attributes: { color_temp_kelvin: 6600 } })).toBe(0xffffff)
		expect(lightColorNumber({ state: 'off', attributes: { rgb_color: [255, 0, 0] } })).toBeUndefined()
	})
})
