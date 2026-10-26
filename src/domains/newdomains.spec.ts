import { describe, expect, it } from 'vitest'
import { mockConnection, mockContext } from '../__mocks__/connection.js'
import { activeDomains } from './index.js'
import { climateDomain } from './climate.js'
import { coverDomain } from './cover.js'
import { lockDomain } from './lock.js'
import { mediaPlayerDomain } from './media_player.js'
import { numberDomain } from './number.js'

const signal = new AbortController().signal

const run = async (def: any, options: Record<string, unknown>): Promise<any> =>
	def.callback({ id: 'a', actionId: 'x', controlId: 'c', options }, { signal })

describe('new domain service mapping', () => {
	it('cover set position', async () => {
		const { conn, sent } = mockConnection()
		const actions = coverDomain.actions!(mockContext(conn))
		await run(actions.cover_position, { entity_id: ['cover.a'], position: 40 })
		expect(sent[0]).toMatchObject({
			domain: 'cover',
			service: 'set_cover_position',
			service_data: { entity_id: ['cover.a'], position: 40 },
		})
	})

	it('lock open', async () => {
		const { conn, sent } = mockConnection()
		const actions = lockDomain.actions!(mockContext(conn))
		await run(actions.lock_open, { entity_id: ['lock.a'] })
		expect(sent[0]).toMatchObject({ domain: 'lock', service: 'open' })
	})

	it('climate step is clamped to min/max/step', async () => {
		const { conn, sent } = mockConnection()
		const ctx = mockContext(conn, {
			'climate.a': {
				state: 'heat',
				attributes: { temperature: 29.5, min_temp: 7, max_temp: 30, target_temp_step: 0.5 },
			},
		})
		await run(climateDomain.actions!(ctx).climate_step_temperature, { entity_id: ['climate.a'], delta: 2 })
		expect(sent[0]).toMatchObject({
			domain: 'climate',
			service: 'set_temperature',
			service_data: { entity_id: 'climate.a', temperature: 30 },
		})
	})

	it('climate range mode steps and sets low/high', async () => {
		const { conn, sent } = mockConnection()
		const ctx = mockContext(conn, {
			'climate.a': {
				state: 'heat_cool',
				attributes: { target_temp_low: 18, target_temp_high: 24, min_temp: 7, max_temp: 30 },
			},
		})
		const actions = climateDomain.actions!(ctx)
		await run(actions.climate_step_temperature, { entity_id: ['climate.a'], delta: 1 })
		await run(actions.climate_set_temperature, { entity_id: ['climate.a'], temperature: 20, low: 17, high: 25 })
		expect(sent[0].service_data).toMatchObject({ target_temp_low: 19, target_temp_high: 25 })
		expect(sent[1].service_data).toMatchObject({ target_temp_low: 17, target_temp_high: 25 })
		expect(sent[1].service_data).not.toHaveProperty('temperature')
	})

	it('media player volume step is relative and clamped', async () => {
		const { conn, sent } = mockConnection()
		const ctx = mockContext(conn, { 'media_player.a': { state: 'on', attributes: { volume_level: 0.98 } } })
		await run(mediaPlayerDomain.actions!(ctx).media_volume_step, { entity_id: ['media_player.a'], pct: 5 })
		expect(sent[0].service_data).toMatchObject({ volume_level: 1 })
	})

	it('number set picks the service domain per entity and clamps', async () => {
		const { conn, sent } = mockConnection()
		const ctx = mockContext(conn, {
			'input_number.a': { state: '5', attributes: { min: 0, max: 10, step: 1 } },
			'number.b': { state: '5', attributes: { min: 0, max: 100, step: 5 } },
		})
		await run(numberDomain.actions!(ctx).number_set, { entity_id: ['input_number.a', 'number.b'], value: 42 })
		expect(sent.map((m) => [m.domain, (m.service_data as { value: number }).value])).toEqual([
			['input_number', 10],
			['number', 40],
		])
	})
})

describe('domain registration', () => {
	const ids = (present?: string[]): string[] => activeDomains(present ? new Set(present) : undefined).map((d) => d.id)
	it('registers everything while entities are unknown', () => {
		expect(ids()).toContain('climate')
	})
	it('registers only domains with entities, plus generic', () => {
		expect(ids(['light', 'input_number'])).toEqual(['light', 'number', 'generic'])
	})
})
