import { describe, expect, it } from 'vitest'
import { CallServiceTargetsAndKelvin, convertMiredsPayload, UpgradeScripts } from './upgrades.js'

const lit = (value: unknown): { isExpression: false; value: never } => ({ isExpression: false, value: value as never })
const expr = (value: string): { isExpression: true; value: string } => ({ isExpression: true, value })

const run = (options: Record<string, unknown>, actionId = 'call_service') => {
	const action = { id: 'a', controlId: 'c', actionId, options } as never
	return CallServiceTargetsAndKelvin(
		{ currentConfig: {} },
		{ config: null, secrets: null, actions: [action], feedbacks: [] },
	)
}

describe('CallServiceTargetsAndKelvin', () => {
	it('adds target_type and return_response to literal options', () => {
		const res = run({ entity_id: lit(['light.a']), service: lit('light.turn_on'), payload: lit('{}') })
		expect(res.updatedActions).toHaveLength(1)
		expect(res.updatedActions[0].options).toMatchObject({
			target_type: lit('entity'),
			return_response: lit(false),
			entity_id: lit(['light.a']),
		})
	})

	it('keeps expression options untouched', () => {
		const res = run({ entity_id: expr('[$(local:id)]'), payload: expr('$(local:p)') })
		const o = res.updatedActions[0].options
		expect(o.entity_id).toEqual(expr('[$(local:id)]'))
		expect(o.payload).toEqual(expr('$(local:p)'))
		expect(o.target_type).toEqual(lit('entity'))
	})

	it('converts mireds in a literal payload only', () => {
		const res = run({ payload: lit('{"color_temp": 250, "brightness": 10}') })
		expect(JSON.parse(res.updatedActions[0].options.payload!.value as string)).toEqual({
			brightness: 10,
			color_temp_kelvin: 4000,
		})
		const exprRes = run({ payload: expr('"{\\"color_temp\\": 250}"') })
		expect(exprRes.updatedActions[0].options.payload).toEqual(expr('"{\\"color_temp\\": 250}"'))
	})

	it('is a no-op when already upgraded or for other actions', () => {
		expect(run({ target_type: lit('area'), return_response: lit(true), payload: lit('{}') }).updatedActions).toEqual([])
		expect(run({}, 'set_switch').updatedActions).toEqual([])
	})

	it('is registered last', () => {
		expect(UpgradeScripts.at(-1)).toBe(CallServiceTargetsAndKelvin)
	})
})

describe('convertMiredsPayload', () => {
	it('ignores invalid, already kelvin and non-light payloads', () => {
		expect(convertMiredsPayload('{nope')).toBeUndefined()
		expect(convertMiredsPayload('{"color_temp_kelvin": 3000, "color_temp": 300}')).toBeUndefined()
		expect(convertMiredsPayload('{"option": "x"}')).toBeUndefined()
		expect(convertMiredsPayload('[1]')).toBeUndefined()
	})
})
