import { EntityPicker, OnOffPicker } from '../choices.js'
import { entityActions, entityTemplatePreset, subscribeEntityPicker, unsubscribeEntityPicker } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

export type LockActions = {
	lock_lock: EntityAction
	lock_unlock: EntityAction
	lock_open: EntityAction
}
export type LockFeedbacks = {
	lock_locked: { type: 'boolean'; options: { entity_id: string; state: boolean } }
	lock_jammed: { type: 'boolean'; options: { entity_id: string } }
}

export const lockDomain = defineDomain<LockActions, LockFeedbacks>({
	id: 'lock',
	actions: (ctx) =>
		entityActions(ctx, 'lock', {
			lock_lock: { name: 'Lock: Lock', service: 'lock' },
			lock_unlock: { name: 'Lock: Unlock', service: 'unlock' },
			lock_open: { name: 'Lock: Open (release latch)', service: 'open' },
		}),
	feedbacks: (ctx) => ({
		lock_locked: {
			type: 'boolean',
			name: 'Lock is locked',
			description: 'If the lock state matches the rule, change style of the bank',
			options: [EntityPicker(ctx.getState(), 'lock'), OnOffPicker()],
			defaultStyle: { color: 0x000000, bgcolor: 0x00ff00 },
			callback: (feedback): boolean => {
				subscribeEntityPicker(ctx, feedback)
				const entity = ctx.getStateObj()[feedback.options.entity_id]
				return !!entity && (entity.state === 'locked') === !!feedback.options.state
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
		lock_jammed: {
			type: 'boolean',
			name: 'Lock is jammed',
			options: [EntityPicker(ctx.getState(), 'lock')],
			defaultStyle: { color: 0xffffff, bgcolor: 0xff0000 },
			callback: (feedback): boolean => {
				subscribeEntityPicker(ctx, feedback)
				return ctx.getStateObj()[feedback.options.entity_id]?.state === 'jammed'
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'lock',
			presetId: 'lock_lock',
			name: 'Lock X',
			sectionId: 'lock',
			sectionName: 'Lock',
			labelPrefix: 'Lock',
			actionId: 'lock_lock',
			feedback: { feedbackId: 'lock_locked', options: { state: true } },
			notes: 'Template: one button per lock. Pressing locks it, and the button lights up while locked.',
		}),
})
