import { EntityMultiplePicker, OnOffTogglePicker } from '../choices.js'
import { entityOnOff } from '../hass/service.js'
import type { OnOffToggle } from '../util.js'
import { entityTemplatePreset, onOffStateFeedback } from './helpers.js'
import { defineDomain } from './types.js'

export type SwitchActions = {
	set_switch: { options: { entity_id: string[]; state: OnOffToggle } }
}
export type SwitchFeedbacks = {
	switch_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const switchDomain = defineDomain<SwitchActions, SwitchFeedbacks>({
	id: 'switch',
	actions: (ctx) => ({
		set_switch: {
			name: 'Set switch state',
			options: [EntityMultiplePicker(ctx.getState(), 'switch'), OnOffTogglePicker()],
			callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
		},
	}),
	feedbacks: (ctx) => ({
		switch_state: onOffStateFeedback(
			ctx,
			'switch',
			'Change from switch state',
			'If the switch state matches the rule, change style of the bank',
		),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'switch',
			presetId: 'switch_toggle',
			name: 'Switch X',
			sectionId: 'switch',
			sectionName: 'Switch',
			labelPrefix: 'Switch',
			actionId: 'set_switch',
			toggleFeedbackId: 'switch_state',
		}),
})
