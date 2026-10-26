import { entityActions, entityTemplatePreset, numberAttributeFeedback } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

export type ValveActions = {
	valve_open: EntityAction
	valve_close: EntityAction
	valve_stop: EntityAction
	valve_position: EntityAction<{ position: number }>
}
export type ValveFeedbacks = {
	valve_position: { type: 'value'; options: { entity_id: string }; result: number }
}

export const valveDomain = defineDomain<ValveActions, ValveFeedbacks>({
	id: 'valve',
	actions: (ctx) =>
		entityActions(ctx, 'valve', {
			valve_open: { name: 'Valve: Open', service: 'open_valve' },
			valve_close: { name: 'Valve: Close', service: 'close_valve' },
			valve_stop: { name: 'Valve: Stop', service: 'stop_valve' },
			valve_position: {
				name: 'Valve: Set position',
				service: 'set_valve_position',
				fields: [
					{ type: 'number', label: 'Position', id: 'position', default: 50, min: 0, max: 100, step: 1, range: true },
				],
				data: (o) => ({ position: Number(o.position) }),
			},
		}),
	feedbacks: (ctx) => ({
		valve_position: numberAttributeFeedback(ctx, 'valve', 'Valve position', 'current_position', -1),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'valve',
			presetId: 'valve_open',
			name: 'Valve X',
			sectionId: 'valve',
			sectionName: 'Valve',
			labelPrefix: 'Valve',
			actionId: 'valve_open',
		}),
})
