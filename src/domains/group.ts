import { EntityMultiplePicker, OnOffTogglePicker } from '../choices.js'
import { entityOnOff } from '../hass/service.js'
import type { OnOffToggle } from '../util.js'
import { entityTemplatePreset, onOffStateFeedback } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type GroupActions = {
	set_group_on: { options: { entity_id: string[]; state: OnOffToggle }; result: ActionResult }
}
export type GroupFeedbacks = {
	group_on_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const groupDomain = defineDomain<GroupActions, GroupFeedbacks>({
	id: 'group',
	actions: (ctx) => ({
		set_group_on: {
			name: 'Set group on/off state',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'group'), OnOffTogglePicker()],
			callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
		},
	}),
	feedbacks: (ctx) => ({
		group_on_state: onOffStateFeedback(
			ctx,
			'group',
			'Change from group on state',
			'If the group state matches the rule, change style of the bank',
		),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'group',
			presetId: 'group_set_on',
			name: 'Group X',
			sectionId: 'group',
			sectionName: 'Group',
			labelPrefix: 'Group',
			actionId: 'set_group_on',
			toggleFeedbackId: 'group_on_state',
		}),
})
