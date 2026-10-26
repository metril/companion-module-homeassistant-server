import { clampToStep } from '../hass/numbers.js'
import { entityActions, entityTemplatePreset, textFeedback } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

export type MediaPlayerActions = {
	media_play_pause: EntityAction
	media_next: EntityAction
	media_previous: EntityAction
	media_volume_set: EntityAction<{ pct: number }>
	media_volume_step: EntityAction<{ pct: number }>
	media_mute: EntityAction<{ mute: string }>
	media_source: EntityAction<{ source: string }>
}
export type MediaPlayerFeedbacks = {
	media_state: { type: 'value'; options: { entity_id: string }; result: string }
	media_title: { type: 'value'; options: { entity_id: string }; result: string }
}

export const mediaPlayerDomain = defineDomain<MediaPlayerActions, MediaPlayerFeedbacks>({
	id: 'media_player',
	actions: (ctx) =>
		entityActions(ctx, 'media_player', {
			media_play_pause: { name: 'Media player: Play/pause', service: 'media_play_pause' },
			media_next: { name: 'Media player: Next track', service: 'media_next_track' },
			media_previous: { name: 'Media player: Previous track', service: 'media_previous_track' },
			media_volume_set: {
				name: 'Media player: Set volume (percentage)',
				service: 'volume_set',
				fields: [{ type: 'number', label: 'Volume', id: 'pct', default: 30, min: 0, max: 100, step: 1, range: true }],
				data: (o) => ({ volume_level: Number(o.pct) / 100 }),
			},
			media_volume_step: {
				name: 'Media player: Adjust volume (percentage)',
				service: 'volume_set',
				fields: [{ type: 'number', label: 'Adjustment', id: 'pct', default: 5, min: -100, max: 100, step: 1 }],
				perEntity: (o, entity) => ({
					data: {
						volume_level: clampToStep(Number(entity.attributes.volume_level ?? 0) + Number(o.pct) / 100, 0, 1, 0.01),
					},
				}),
			},
			media_mute: {
				name: 'Media player: Mute',
				service: 'volume_mute',
				fields: [
					{
						type: 'dropdown',
						id: 'mute',
						label: 'Mute',
						default: 'toggle',
						choices: [
							{ id: 'mute', label: 'Mute' },
							{ id: 'unmute', label: 'Unmute' },
							{ id: 'toggle', label: 'Toggle' },
						],
						disableAutoExpression: true,
					},
				],
				perEntity: (o, entity) => ({
					data: {
						is_volume_muted: o.mute === 'toggle' ? !entity.attributes.is_volume_muted : o.mute === 'mute',
					},
				}),
			},
			media_source: {
				name: 'Media player: Select source',
				service: 'select_source',
				fields: [{ type: 'textinput', id: 'source', default: '', label: 'Source' }],
				data: (o) => ({ source: o.source }),
			},
		}),
	feedbacks: (ctx) => ({
		media_state: textFeedback(ctx, 'media_player', 'Media player state'),
		media_title: textFeedback(ctx, 'media_player', 'Media player title', 'media_title'),
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'media_player',
			presetId: 'media_play_pause',
			name: 'Media player X',
			sectionId: 'media_player',
			sectionName: 'Media player',
			labelPrefix: 'Media player',
			actionId: 'media_play_pause',
		}),
})
