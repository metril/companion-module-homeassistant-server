import { EntityMultiplePicker, EntityPicker } from '../choices.js'
import { callEntityService, subscribeEntityPicker, unsubscribeEntityPicker } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type InputSelectActions = {
	input_select_first: { options: { entity_id: string[] }; result: ActionResult }
	input_select_last: { options: { entity_id: string[] }; result: ActionResult }
	input_select_next: { options: { entity_id: string[] }; result: ActionResult }
	input_select_previous: { options: { entity_id: string[] }; result: ActionResult }
	input_select_set: { options: { entity_id: string[]; option: string }; result: ActionResult }
}
export type InputSelectFeedbacks = {
	input_select_state: { type: 'boolean'; options: { entity_id: string; option: string } }
}

export const inputSelectDomain = defineDomain<InputSelectActions, InputSelectFeedbacks>({
	id: 'input_select',
	actions: (ctx) => ({
		input_select_first: {
			name: 'Input Select: First',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'input_select')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'input_select', 'select_first'),
		},
		input_select_last: {
			name: 'Input Select: Last',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'input_select')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'input_select', 'select_last'),
		},
		input_select_next: {
			name: 'Input Select: Next',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'input_select')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'input_select', 'select_next'),
		},
		input_select_previous: {
			name: 'Input Select: Previous',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'input_select')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'input_select', 'select_previous'),
		},
		input_select_set: {
			name: 'Input Select: Select',
			hasResult: true,
			options: [
				EntityMultiplePicker(ctx.getState(), 'input_select'),
				{
					type: 'textinput',
					id: 'option',
					default: '',
					label: 'Option',
				},
			],
			callback: async (evt, context) =>
				callEntityService(ctx, evt, context, 'input_select', 'select_option', { option: evt.options.option }),
		},
	}),
	feedbacks: (ctx) => ({
		input_select_state: {
			type: 'boolean',
			name: 'Change from input select state',
			description: 'If the input select state matches the rule, change style of the bank',
			options: [
				EntityPicker(ctx.getState(), 'input_select'),
				{
					type: 'textinput',
					id: 'option',
					default: '',
					label: 'Option',
				},
			],
			defaultStyle: {
				color: 0x000000,
				bgcolor: 0x00ff00,
			},
			callback: (feedback): boolean => {
				subscribeEntityPicker(ctx, feedback)
				const entity = ctx.getStateObj()[String(feedback.options.entity_id)]
				if (entity) {
					return entity.state === feedback.options.option
				}
				return false
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
	}),
})
