export type ColorMode = 'kelvin' | 'rgb' | 'hs'

const COLOR_MODES = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww'])

/** Throw if the light's supported_color_modes cannot do the requested colour mode */
export function validateColorMode(mode: ColorMode, supported: string[] | undefined, entityId = 'light'): void {
	// Unknown capabilities (eg state not loaded yet): let HA decide
	if (supported === undefined) return
	const modes = supported
	const ok = mode === 'kelvin' ? modes.includes('color_temp') : modes.some((m) => COLOR_MODES.has(m))
	if (!ok) {
		const what = mode === 'kelvin' ? 'colour temperature' : 'colour'
		throw new Error(`${entityId} does not support ${what} (supported modes: ${modes.join(', ') || 'none'})`)
	}
}

/** Kelvin to approximate RGB (Tanner Helland), for showing a colour-temperature light on a button */
export function kelvinToRgb(kelvin: number): [number, number, number] {
	const t = Math.min(Math.max(kelvin, 1000), 40000) / 100
	const clamp = (v: number): number => Math.round(Math.min(255, Math.max(0, v)))
	const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
	const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
	const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
	return [clamp(r), clamp(g), clamp(b)]
}

export const rgbToNumber = (rgb: [number, number, number]): number => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
export const numberToRgb = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255]

/** The colour a light is currently showing, as 0xRRGGBB, or undefined if off/unknown */
export function lightColorNumber(
	entity: { state: string; attributes: Record<string, unknown> } | undefined,
): number | undefined {
	if (!entity || entity.state !== 'on') return undefined
	const rgb = entity.attributes.rgb_color
	if (Array.isArray(rgb) && rgb.length >= 3) return rgbToNumber([Number(rgb[0]), Number(rgb[1]), Number(rgb[2])])
	const k = entity.attributes.color_temp_kelvin
	if (typeof k === 'number') return rgbToNumber(kelvinToRgb(k))
	return undefined
}
