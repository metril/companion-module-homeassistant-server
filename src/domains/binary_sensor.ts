import { onOffStateFeedback } from './helpers.js'
import { defineDomain } from './types.js'

export type BinarySensorFeedbacks = {
	binary_sensor_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
}

export const binarySensorDomain = defineDomain<Record<string, never>, BinarySensorFeedbacks>({
	id: 'binary_sensor',
	feedbacks: (ctx) => ({
		binary_sensor_state: onOffStateFeedback(
			ctx,
			'binary_sensor',
			'Change from binary sensor state',
			'If the binary sensor state matches the rule, change style of the bank',
		),
	}),
})
