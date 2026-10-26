import { entityActions, entityTemplatePreset } from './helpers.js'
import { defineDomain, type EntityAction } from './types.js'

export type SelectActions = {
	select_first: EntityAction
	select_last: EntityAction
	select_next: EntityAction
	select_previous: EntityAction
	select_option: EntityAction<{ option: string }>
}

export const selectDomain = defineDomain<SelectActions>({
	id: 'select',
	actions: (ctx) =>
		entityActions(ctx, 'select', {
			select_first: { name: 'Select: First', service: 'select_first' },
			select_last: { name: 'Select: Last', service: 'select_last' },
			select_next: { name: 'Select: Next', service: 'select_next' },
			select_previous: { name: 'Select: Previous', service: 'select_previous' },
			select_option: {
				name: 'Select: Select option',
				service: 'select_option',
				fields: [{ type: 'textinput', id: 'option', default: '', label: 'Option' }],
				data: (o) => ({ option: o.option }),
			},
		}),
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'select',
			presetId: 'select_next',
			name: 'Select X',
			sectionId: 'select',
			sectionName: 'Select',
			labelPrefix: 'Select',
			actionId: 'select_next',
		}),
})
