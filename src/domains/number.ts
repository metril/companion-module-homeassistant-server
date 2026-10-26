import { EntityMultiplePicker, EntityPicker } from '../choices.js'
import { entityDomain } from '../filter.js'
import { clampToStep } from '../hass/numbers.js'
import { invokeService } from '../hass/service.js'
import { subscribeEntityPicker, toIds, unsubscribeEntityPicker } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type NumberActions = {
	number_set: { options: { entity_id: string[]; value: number }; result: ActionResult }
	number_step: { options: { entity_id: string[]; delta: number }; result: ActionResult }
}
export type NumberFeedbacks = {
	number_value: { type: 'value'; options: { entity_id: string }; result: number }
}

/** Handles both `number` and `input_number` entities, clamped to the entity's min, max and step */
export const numberDomain = defineDomain<NumberActions, NumberFeedbacks>({
	id: 'number',
	alsoDomains: ['input_number'],
	actions: (ctx) => {
		const numbers = ctx.getState().filter((e) => ['number', 'input_number'].includes(entityDomain(e.entity_id)))

		const apply = async (
			ids: string[],
			signal: AbortSignal,
			compute: (current: number, min: number, max: number, step: number | undefined) => number,
		): Promise<ActionResult> => {
			for (const id of ids) {
				const entity = ctx.getStateObj()[id]
				if (!entity) throw new Error(`${id} is not available`)
				const a = entity.attributes
				const value = compute(
					Number(entity.state),
					Number(a.min ?? -Infinity),
					Number(a.max ?? Infinity),
					Number(a.step) || undefined,
				)
				await invokeService(ctx.getClient(), {
					domain: entityDomain(id),
					service: 'set_value',
					data: { entity_id: id, value },
					signal,
				})
			}
			return { service: 'number.set_value', entity_id: ids }
		}

		return {
			number_set: {
				name: 'Number: Set value',
				description: 'Sets a number or input_number, clamped to the entity min, max and step',
				hasResult: true,
				options: [
					EntityMultiplePicker(numbers, undefined),
					{ type: 'number', label: 'Value', id: 'value', default: 0, min: -1e9, max: 1e9 },
				],
				callback: async (evt, context) =>
					apply(toIds(evt.options.entity_id), context.signal, (_c, min, max, step) =>
						clampToStep(Number(evt.options.value), min, max, step),
					),
			},
			number_step: {
				name: 'Number: Adjust value',
				description: 'Adds to a number or input_number, clamped to the entity min, max and step',
				hasResult: true,
				options: [
					EntityMultiplePicker(numbers, undefined),
					{ type: 'number', label: 'Adjustment', id: 'delta', default: 1, min: -1e9, max: 1e9 },
				],
				callback: async (evt, context) =>
					apply(toIds(evt.options.entity_id), context.signal, (current, min, max, step) =>
						clampToStep((Number.isFinite(current) ? current : 0) + Number(evt.options.delta), min, max, step),
					),
			},
		}
	},
	feedbacks: (ctx) => ({
		number_value: {
			type: 'value',
			name: 'Number value',
			description: 'The numeric state of a number or input_number, or 0 if unavailable',
			options: [
				EntityPicker(
					ctx.getState().filter((e) => ['number', 'input_number'].includes(entityDomain(e.entity_id))),
					undefined,
				),
			],
			callback: (feedback): number => {
				subscribeEntityPicker(ctx, feedback)
				const v = Number(ctx.getStateObj()[feedback.options.entity_id]?.state)
				return Number.isFinite(v) ? v : 0
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
	}),
})
