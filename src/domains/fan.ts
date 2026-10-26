import { EntityMultiplePicker, OnOffTogglePicker } from '../choices.js'
import { entityOnOff } from '../hass/service.js'
import { clampToStep } from '../hass/numbers.js'
import type { OnOffToggle } from '../util.js'
import { entityActions, entityTemplatePreset, onOffStateFeedback } from './helpers.js'
import { defineDomain, type ActionResult, type EntityAction } from './types.js'

export type FanActions = {
	fan_on_off: { options: { entity_id: string[]; state: OnOffToggle }; result: ActionResult }
	fan_percentage: EntityAction<{ pct: number }>
	fan_step: EntityAction<{ pct: number }>
	fan_preset: EntityAction<{ preset: string }>
	fan_oscillate: EntityAction<{ oscillating: boolean }>
}
export type FanFeedbacks = {
	fan_on_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const fanDomain = defineDomain<FanActions, FanFeedbacks>({
	id: 'fan',
	actions: (ctx) => ({
		fan_on_off: {
			name: 'Fan: Set on/off state',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'fan'), OnOffTogglePicker()],
			callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
		},
		...entityActions(ctx, 'fan', {
			fan_percentage: {
				name: 'Fan: Set speed (percentage)',
				service: 'set_percentage',
				fields: [{ type: 'number', label: 'Speed', id: 'pct', default: 50, min: 0, max: 100, step: 1, range: true }],
				data: (o) => ({ percentage: Number(o.pct) }),
			},
			fan_step: {
				name: 'Fan: Adjust speed (percentage)',
				service: 'set_percentage',
				fields: [{ type: 'number', label: 'Adjustment', id: 'pct', default: 10, min: -100, max: 100, step: 1 }],
				perEntity: (o, entity) => ({
					data: {
						percentage: clampToStep(
							Number(entity.attributes.percentage ?? 0) + Number(o.pct),
							0,
							100,
							Number(entity.attributes.percentage_step) || 1,
						),
					},
				}),
			},
			fan_preset: {
				name: 'Fan: Set preset mode',
				service: 'set_preset_mode',
				fields: [{ type: 'textinput', id: 'preset', default: '', label: 'Preset mode' }],
				data: (o) => ({ preset_mode: o.preset }),
			},
			fan_oscillate: {
				name: 'Fan: Set oscillation',
				service: 'oscillate',
				fields: [{ type: 'checkbox', id: 'oscillating', default: true, label: 'Oscillating' }],
				data: (o) => ({ oscillating: !!o.oscillating }),
			},
		}),
	}),
	feedbacks: (ctx) => ({
		fan_on_state: onOffStateFeedback(
			ctx,
			'fan',
			'Change from fan on state',
			'If the fan state matches the rule, change style of the bank',
		),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'fan',
			presetId: 'fan_toggle',
			name: 'Fan X',
			sectionId: 'fan',
			sectionName: 'Fan',
			labelPrefix: 'Fan',
			actionId: 'fan_on_off',
			toggleFeedbackId: 'fan_on_state',
		}),
})
