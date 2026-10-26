import { entityActions, entityTemplatePreset, numberAttributeFeedback } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

const pct = (id: string, label: string) =>
	({ type: 'number', label, id, default: 50, min: 0, max: 100, step: 1, range: true }) as const

export type CoverActions = {
	cover_open: EntityAction
	cover_close: EntityAction
	cover_stop: EntityAction
	cover_position: EntityAction<{ position: number }>
	cover_tilt: EntityAction<{ tilt: number }>
}
export type CoverFeedbacks = {
	cover_position: { type: 'value'; options: { entity_id: string }; result: number }
	cover_tilt: { type: 'value'; options: { entity_id: string }; result: number }
}

export const coverDomain = defineDomain<CoverActions, CoverFeedbacks>({
	id: 'cover',
	actions: (ctx) =>
		entityActions(ctx, 'cover', {
			cover_open: { name: 'Cover: Open', service: 'open_cover' },
			cover_close: { name: 'Cover: Close', service: 'close_cover' },
			cover_stop: { name: 'Cover: Stop', service: 'stop_cover' },
			cover_position: {
				name: 'Cover: Set position',
				service: 'set_cover_position',
				fields: [pct('position', 'Position (0 = closed, 100 = open)')],
				data: (o) => ({ position: Number(o.position) }),
			},
			cover_tilt: {
				name: 'Cover: Set tilt position',
				service: 'set_cover_tilt_position',
				fields: [pct('tilt', 'Tilt position')],
				data: (o) => ({ tilt_position: Number(o.tilt) }),
			},
		}),
	feedbacks: (ctx) => ({
		cover_position: numberAttributeFeedback(ctx, 'cover', 'Cover position', 'current_position', -1),
		cover_tilt: numberAttributeFeedback(ctx, 'cover', 'Cover tilt position', 'current_tilt_position', -1),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'cover',
			presetId: 'cover_open',
			name: 'Cover X',
			sectionId: 'cover',
			sectionName: 'Cover',
			labelPrefix: 'Cover',
			actionId: 'cover_open',
		}),
})
