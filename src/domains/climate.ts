import { clampToStep } from '../hass/numbers.js'
import { entityActions, numberAttributeFeedback } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

const HVAC_MODES = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only']

export type ClimateActions = {
	climate_hvac_mode: EntityAction<{ hvac_mode: string }>
	climate_set_temperature: EntityAction<{ temperature: number }>
	climate_step_temperature: EntityAction<{ delta: number }>
	climate_preset: EntityAction<{ preset: string }>
}
export type ClimateFeedbacks = {
	climate_current_temperature: { type: 'value'; options: { entity_id: string }; result: number }
	climate_target_temperature: { type: 'value'; options: { entity_id: string }; result: number }
}

export const climateDomain = defineDomain<ClimateActions, ClimateFeedbacks>({
	id: 'climate',
	actions: (ctx) =>
		entityActions(ctx, 'climate', {
			climate_hvac_mode: {
				name: 'Climate: Set HVAC mode',
				service: 'set_hvac_mode',
				fields: [
					{
						type: 'dropdown',
						id: 'hvac_mode',
						label: 'Mode',
						default: 'heat',
						choices: HVAC_MODES.map((m) => ({ id: m, label: m })),
						allowCustom: true,
					},
				],
				data: (o) => ({ hvac_mode: o.hvac_mode }),
			},
			climate_set_temperature: {
				name: 'Climate: Set target temperature',
				service: 'set_temperature',
				fields: [
					{ type: 'number', label: 'Temperature', id: 'temperature', default: 20, min: -50, max: 100, step: 0.5 },
				],
				data: (o) => ({ temperature: Number(o.temperature) }),
			},
			climate_step_temperature: {
				name: 'Climate: Adjust target temperature',
				service: 'set_temperature',
				fields: [{ type: 'number', label: 'Adjustment', id: 'delta', default: 0.5, min: -50, max: 50, step: 0.1 }],
				perEntity: (o, entity) => {
					const a = entity.attributes
					const target = Number(a.temperature)
					if (!Number.isFinite(target)) throw new Error(`${entity.entity_id} has no target temperature`)
					return {
						data: {
							temperature: clampToStep(
								target + Number(o.delta),
								Number(a.min_temp ?? -Infinity),
								Number(a.max_temp ?? Infinity),
								Number(a.target_temp_step) || undefined,
							),
						},
					}
				},
			},
			climate_preset: {
				name: 'Climate: Set preset mode',
				service: 'set_preset_mode',
				fields: [{ type: 'textinput', id: 'preset', default: '', label: 'Preset mode' }],
				data: (o) => ({ preset_mode: o.preset }),
			},
		}),
	feedbacks: (ctx) => ({
		climate_current_temperature: numberAttributeFeedback(
			ctx,
			'climate',
			'Climate current temperature',
			'current_temperature',
			0,
		),
		climate_target_temperature: numberAttributeFeedback(ctx, 'climate', 'Climate target temperature', 'temperature', 0),
	}),
})
