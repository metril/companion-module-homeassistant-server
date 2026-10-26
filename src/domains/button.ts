import { EntityMultiplePicker } from '../choices.js'
import { callEntityService, entityTemplatePreset } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type ButtonActions = {
	press_button: { options: { entity_id: string[] }; result: ActionResult }
}

export const buttonDomain = defineDomain<ButtonActions>({
	id: 'button',
	actions: (ctx) => ({
		press_button: {
			name: 'Press button',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'button')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'button', 'press'),
		},
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'button',
			presetId: 'button_press',
			name: 'Button X',
			sectionId: 'button',
			sectionName: 'Button',
			labelPrefix: 'Button',
			actionId: 'press_button',
		}),
})
