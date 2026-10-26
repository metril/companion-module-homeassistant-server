import { EntityMultiplePicker } from '../choices.js'
import { callEntityService, entityTemplatePreset } from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type ScriptActions = {
	execute_script: { options: { entity_id: string[] }; result: ActionResult }
}

export const scriptDomain = defineDomain<ScriptActions>({
	id: 'script',
	actions: (ctx) => ({
		execute_script: {
			name: 'Execute script',
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), 'script')],
			callback: async (evt, context) => callEntityService(ctx, evt, context, 'homeassistant', 'turn_on'),
		},
	}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'script',
			presetId: 'script_execute',
			name: 'Script X',
			sectionId: 'script',
			sectionName: 'Script',
			labelPrefix: 'Script',
			actionId: 'execute_script',
		}),
})
