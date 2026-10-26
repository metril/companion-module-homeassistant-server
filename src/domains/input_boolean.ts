import { EntityMultiplePicker, OnOffTogglePicker } from '../choices.js'
import { entityOnOff } from '../hass/service.js'
import type { OnOffToggle } from '../util.js'
import { entityTemplatePreset, onOffStateFeedback } from './helpers.js'
import { defineDomain } from './types.js'

export type InputBooleanActions = {
	set_input_boolean: { options: { entity_id: string[]; state: OnOffToggle } }
}
export type InputBooleanFeedbacks = {
	input_boolean_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const inputBooleanDomain = defineDomain<InputBooleanActions, InputBooleanFeedbacks>({
	id: 'input_boolean',
	actions: (ctx) => ({
		set_input_boolean: {
			name: 'Set input_boolean state',
			options: [EntityMultiplePicker(ctx.getState(), 'input_boolean'), OnOffTogglePicker()],
			callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
		},
	}),
	feedbacks: (ctx) => ({
		input_boolean_state: onOffStateFeedback(
			ctx,
			'input_boolean',
			'Change from input_boolean state',
			'If the input_boolean state matches the rule, change style of the bank',
		),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'input_boolean',
			presetId: 'input_boolean_set',
			name: 'Input Boolean X',
			sectionId: 'input_boolean',
			sectionName: 'Input Boolean',
			labelPrefix: 'Input Boolean',
			actionId: 'set_input_boolean',
			toggleFeedbackId: 'input_boolean_state',
		}),
})
