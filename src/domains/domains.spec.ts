import { describe, expect, it } from 'vitest'
import { mockConnection, mockContext } from '../__mocks__/connection.js'
import { invokeService } from '../hass/service.js'
import { genericDomain } from './generic.js'
import { lightDomain } from './light.js'
import { switchDomain } from './switch.js'

const signal = new AbortController().signal

const evt = (options: Record<string, unknown>): any => ({ id: 'a1', actionId: 'x', controlId: 'c', options })

const run = async (def: any, options: Record<string, unknown>): Promise<any> => def.callback(evt(options), { signal })

describe('invokeService', () => {
	it('throws when not connected', async () => {
		await expect(invokeService(undefined, { domain: 'a', service: 'b' })).rejects.toThrow(/Not connected/)
	})
	it('sends target and return_response', async () => {
		const { conn, sent } = mockConnection()
		await invokeService(conn, {
			domain: 'weather',
			service: 'get_forecasts',
			data: { type: 'daily' },
			target: { entity_id: ['weather.home'] },
			returnResponse: true,
		})
		expect(sent[0]).toMatchObject({
			type: 'call_service',
			domain: 'weather',
			service: 'get_forecasts',
			service_data: { type: 'daily' },
			target: { entity_id: ['weather.home'] },
			return_response: true,
		})
	})
	it('rejects when already aborted', async () => {
		const { conn } = mockConnection()
		const ac = new AbortController()
		ac.abort()
		await expect(invokeService(conn, { domain: 'a', service: 'b', signal: ac.signal })).rejects.toBeDefined()
	})
})

describe('domain service mapping', () => {
	it('maps on/off/toggle to homeassistant services', async () => {
		const { conn, sent } = mockConnection()
		const actions = switchDomain.actions!(mockContext(conn))
		for (const [state, svc] of [
			['on', 'turn_on'],
			['off', 'turn_off'],
			['toggle', 'toggle'],
		]) {
			const res = await run(actions.set_switch, { entity_id: ['switch.a'], state })
			expect(res).toEqual({ service: `homeassistant.${svc}`, entity_id: ['switch.a'] })
		}
		expect(sent.map((m) => m.service)).toEqual(['turn_on', 'turn_off', 'toggle'])
		expect(sent[0].domain).toBe('homeassistant')
	})

	it('sets light colour using the version appropriate parameter', async () => {
		const attrs = { supported_color_modes: ['color_temp', 'rgb'] }
		for (const [version, key] of [
			['2024.6.0', 'color_temp_kelvin'],
			['2022.10.0', 'kelvin'],
		]) {
			const { conn, sent } = mockConnection(version)
			const actions = lightDomain.actions!(mockContext(conn, { 'light.a': { state: 'on', attributes: attrs } }))
			await run(actions.set_light_color, { entity_id: ['light.a'], mode: 'kelvin', kelvin: 3000 })
			expect(sent[0].service_data).toEqual({ entity_id: ['light.a'], [key]: 3000 })
		}
	})

	it('rejects unsupported colour modes without calling HA', async () => {
		const { conn, sent } = mockConnection()
		const actions = lightDomain.actions!(
			mockContext(conn, { 'light.a': { state: 'on', attributes: { supported_color_modes: ['brightness'] } } }),
		)
		await expect(
			run(actions.set_light_color, { entity_id: ['light.a'], mode: 'rgb', color: 0xff0000 }),
		).rejects.toThrow()
		expect(sent).toHaveLength(0)
	})

	it('call_service throws on bad payload and returns the response when requested', async () => {
		const { conn, sent } = mockConnection()
		const ctx = mockContext(conn)
		ctx.getServices = () => ({
			weather: { get_forecasts: { fields: {}, target: {}, response: { optional: false } } },
		})
		const actions = genericDomain.actions!(ctx)
		const base = { target_type: 'entity', entity_id: ['weather.home'], service: 'weather.get_forecasts' }
		await expect(run(actions.call_service, { ...base, payload: '{nope' })).rejects.toThrow()
		await run(actions.call_service, { ...base, payload: '{"type":"daily"}', return_response: false })
		expect(sent[0]).toMatchObject({ return_response: true, target: { entity_id: ['weather.home'] } })
	})
})
