import { clampToStep } from '../hass/numbers.js'
import { entityActions, entityTemplatePreset, numberAttributeFeedback } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

const HVAC_MODES = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only']

/** The low/high target of a climate entity in range (heat_cool) mode, if it has one */
export function targetRange(attrs: Record<string, unknown>): { low: number; high: number } | undefined {
	const low = attrs.target_temp_low
	const high = attrs.target_temp_high
	return typeof low === 'number' && typeof high === 'number' ? { low, high } : undefined
}

export type ClimateActions = {
	climate_hvac_mode: EntityAction<{ hvac_mode: string }>
	climate_set_temperature: EntityAction<{ temperature: number; low: number; high: number }>
	climate_step_temperature: EntityAction<{ delta: number }>
	climate_preset: EntityAction<{ preset: string }>
}
export type ClimateFeedbacks = {
	climate_current_temperature: { type: 'value'; options: { entity_id: string }; result: number }
	climate_target_temperature: { type: 'value'; options: { entity_id: string }; result: number }
	climate_target_temp_low: { type: 'value'; options: { entity_id: string }; result: number }
	climate_target_temp_high: { type: 'value'; options: { entity_id: string }; result: number }
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
				description: 'In heat/cool range mode the low and high temperatures are set instead',
				service: 'set_temperature',
				fields: [
					{ type: 'number', label: 'Temperature', id: 'temperature', default: 20, min: -50, max: 100, step: 0.5 },
					{ type: 'number', label: 'Low (range mode)', id: 'low', default: 18, min: -50, max: 100, step: 0.5 },
					{ type: 'number', label: 'High (range mode)', id: 'high', default: 24, min: -50, max: 100, step: 0.5 },
				],
				perEntity: (o, entity) =>
					targetRange(entity.attributes)
						? { data: { target_temp_low: Number(o.low), target_temp_high: Number(o.high) } }
						: { data: { temperature: Number(o.temperature) } },
			},
			climate_step_temperature: {
				name: 'Climate: Adjust target temperature',
				description: 'In heat/cool range mode both the low and high temperatures are adjusted',
				service: 'set_temperature',
				fields: [{ type: 'number', label: 'Adjustment', id: 'delta', default: 0.5, min: -50, max: 50, step: 0.1 }],
				perEntity: (o, entity) => {
					const a = entity.attributes
					const clamp = (v: number): number =>
						clampToStep(
							v,
							Number(a.min_temp ?? -Infinity),
							Number(a.max_temp ?? Infinity),
							Number(a.target_temp_step) || undefined,
						)
					const delta = Number(o.delta)
					const range = targetRange(a)
					if (range) {
						return { data: { target_temp_low: clamp(range.low + delta), target_temp_high: clamp(range.high + delta) } }
					}
					const target = Number(a.temperature)
					if (!Number.isFinite(target)) throw new Error(`${entity.entity_id} has no target temperature`)
					return { data: { temperature: clamp(target + delta) } }
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
		climate_target_temp_low: numberAttributeFeedback(
			ctx,
			'climate',
			'Climate target temperature (low)',
			'target_temp_low',
			0,
			'Low target in heat/cool range mode',
		),
		climate_target_temp_high: numberAttributeFeedback(
			ctx,
			'climate',
			'Climate target temperature (high)',
			'target_temp_high',
			0,
			'High target in heat/cool range mode',
		),
		climate_target_temperature: numberAttributeFeedback(ctx, 'climate', 'Climate target temperature', 'temperature', 0),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'climate',
			presetId: 'climate_up',
			name: 'Climate X +',
			sectionId: 'climate',
			sectionName: 'Climate',
			labelPrefix: 'Climate',
			actionId: 'climate_step_temperature',
			actionOptions: { delta: 0.5 },
			notes: 'Template: one button per climate entity. Pressing raises the target temperature by 0.5.',
		}),
})
