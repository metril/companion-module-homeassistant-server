import { EntityMultiplePicker } from '../choices.js'
import { callEntityService, entityTemplatePreset } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type SceneActions = {
	activate_scene: { options: { entity_id: string[] }; result: ActionResult }
}

export const sceneDomain = defineDomain<SceneActions>({
	id: 'scene',
	actions: (ctx) => ({
		activate_scene: {
			name: 'Activate scene',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'scene')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'scene', 'turn_on'),
		},
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'scene',
			presetId: 'scene_activate',
			name: 'Scene X',
			sectionId: 'scene',
			sectionName: 'Scene',
			labelPrefix: 'Scene',
			actionId: 'activate_scene',
		}),
})
