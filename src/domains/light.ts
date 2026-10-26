import { EntityMultiplePicker, OnOffTogglePicker } from '../choices.js'
import { entityOnOff } from '../hass/service.js'
import type { OnOffToggle } from '../util.js'
import { callEntityService, entityTemplatePreset, onOffStateFeedback } from './helpers.js'
import { defineDomain } from './types.js'

export type LightActions = {
	set_light_on: { options: { entity_id: string[]; state: OnOffToggle } }
	set_light_pct: { options: { entity_id: string[]; pct: number } }
	adj_light_pct: { options: { entity_id: string[]; pct: number } }
}
export type LightFeedbacks = {
	light_on_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const lightDomain = defineDomain<LightActions, LightFeedbacks>({
	id: 'light',
	actions: (ctx) => {
		const pickerLights = EntityMultiplePicker(ctx.getState(), 'light')
		return {
			set_light_on: {
				name: 'Set light on/off state',
				options: [pickerLights, OnOffTogglePicker()],
				callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
			},
			set_light_pct: {
				name: 'Set light brightness (percentage)',
				options: [
					pickerLights,
					{
						type: 'number',
						label: 'Brightness',
						id: 'pct',
						default: 50,
						min: 0,
						max: 100,
						step: 1,
						range: true,
					},
				],
				callback: async (evt, context) =>
					callEntityService(ctx, evt, context, 'light', 'turn_on', { brightness_pct: Number(evt.options.pct) }),
			},
			adj_light_pct: {
				name: 'Adjust light brightness (percentage)',
				options: [
					pickerLights,
					{
						type: 'number',
						label: 'Adjustment',
						id: 'pct',
						default: 1,
						min: -100,
						max: 100,
						step: 1,
					},
				],
				callback: async (evt, context) =>
					callEntityService(ctx, evt, context, 'light', 'turn_on', {
						brightness_step_pct: Number(evt.options.pct),
					}),
			},
		}
	},
	feedbacks: (ctx) => ({
		light_on_state: onOffStateFeedback(
			ctx,
			'light',
			'Change from light on state',
			'If the light state matches the rule, change style of the bank',
		),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'light',
			presetId: 'light_set',
			name: 'Light X',
			sectionId: 'light',
			sectionName: 'Light',
			labelPrefix: 'Light',
			actionId: 'set_light_on',
			toggleFeedbackId: 'light_on_state',
		}),
})
