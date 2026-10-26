import {
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldMultiDropdown,
	CompanionInputFieldTextInput,
	DropdownChoice,
} from '@companion-module/base'
import type { HassEntity } from 'home-assistant-js-websocket'
import { OnOffToggle } from './util.js'
import type { Registries } from './hass/registries.js'

export const LIGHT_MAX_BRIGHTNESS = 255

export function OnOffTogglePicker(): CompanionInputFieldDropdown<'state'> {
	const options = [
		{ id: OnOffToggle.On, label: 'On' },
		{ id: OnOffToggle.Off, label: 'Off' },
		{ id: OnOffToggle.Toggle, label: 'Toggle' },
	]
	return {
		type: 'dropdown',
		label: 'State',
		id: 'state',
		default: OnOffToggle.On,
		choices: options,
		disableAutoExpression: true,
	}
}

export function OnOffPicker(): CompanionInputFieldCheckbox<'state'> {
	return {
		type: 'checkbox',
		label: 'State',
		id: 'state',
		default: true,
	}
}

function EntityOptions(state: HassEntity[], prefix: string | undefined): DropdownChoice<string>[] {
	const entities = state.filter((ent) => prefix === undefined || ent.entity_id.indexOf(`${prefix}.`) === 0)

	return entities
		.map((ent) => ({
			id: ent.entity_id,
			label: ent.attributes.friendly_name || ent.entity_id,
		}))
		.sort((a, b) => {
			const a2 = a.label.toLowerCase()
			const b2 = b.label.toLowerCase()
			return a2 === b2 ? 0 : a2 < b2 ? -1 : 1
		})
}

export function EntityPicker(
	state: HassEntity[],
	prefix: string | undefined,
): CompanionInputFieldDropdown<'entity_id', string> {
	const choices = EntityOptions(state, prefix)

	return {
		type: 'dropdown',
		label: 'Entity',
		id: 'entity_id',
		default: choices[0]?.id ?? '',
		choices: choices,
	}
}

export function EntityMultiplePicker(
	state: HassEntity[],
	prefix: string | undefined,
): CompanionInputFieldMultiDropdown<'entity_id'> {
	const choices = EntityOptions(state, prefix)

	return {
		type: 'multidropdown',
		label: 'Entities',
		id: 'entity_id',
		default: [],
		choices: choices,
	}
}

export type TargetType = 'entity' | 'area' | 'floor' | 'label' | 'device'

/**
 * Entity/area/floor/label/device target picker.
 * Returns the fields to spread into an action's options; the id of each field is `target_type` or `target_<type>`.
 * Floor and label targets need HA 2024.4+, so are only offered when supported.
 */
export function TargetPicker(
	state: HassEntity[],
	registries: Registries,
	prefix: string | undefined,
	supportsFloorsAndLabels: boolean,
): (CompanionInputFieldDropdown<'target_type'> | CompanionInputFieldMultiDropdown<string>)[] {
	const typeChoices: DropdownChoice<string>[] = [
		{ id: 'entity', label: 'Entity' },
		{ id: 'area', label: 'Area' },
		{ id: 'device', label: 'Device' },
	]
	if (supportsFloorsAndLabels) {
		typeChoices.splice(2, 0, { id: 'floor', label: 'Floor' }, { id: 'label', label: 'Label' })
	}

	const registryChoices = (entries: { id: string; name: string }[]): DropdownChoice<string>[] =>
		entries.map((e) => ({ id: e.id, label: e.name })).sort((a, b) => a.label.localeCompare(b.label))

	const fields: (CompanionInputFieldDropdown<'target_type'> | CompanionInputFieldMultiDropdown<string>)[] = [
		{
			type: 'dropdown',
			label: 'Target type',
			id: 'target_type',
			default: 'entity',
			choices: typeChoices,
			disableAutoExpression: true,
		},
		{
			...EntityMultiplePicker(state, prefix),
			id: 'target_entity',
			isVisibleExpression: '$(options:target_type) == "entity"',
		},
		{
			type: 'multidropdown',
			label: 'Areas',
			id: 'target_area',
			default: [],
			choices: registryChoices(registries.getAreas()),
			isVisibleExpression: '$(options:target_type) == "area"',
		},
		{
			type: 'multidropdown',
			label: 'Devices',
			id: 'target_device',
			default: [],
			choices: registryChoices(registries.getDevices()),
			isVisibleExpression: '$(options:target_type) == "device"',
		},
	]
	if (supportsFloorsAndLabels) {
		fields.push(
			{
				type: 'multidropdown',
				label: 'Floors',
				id: 'target_floor',
				default: [],
				choices: registryChoices(registries.getFloors()),
				isVisibleExpression: '$(options:target_type) == "floor"',
			},
			{
				type: 'multidropdown',
				label: 'Labels',
				id: 'target_label',
				default: [],
				choices: registryChoices(registries.getLabels()),
				isVisibleExpression: '$(options:target_type) == "label"',
			},
		)
	}
	return fields
}

export type Comparison = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex'

export function ComparisonPicker(): CompanionInputFieldDropdown<'comparison'> {
	return {
		type: 'dropdown',
		label: 'Comparison',
		id: 'comparison',
		default: 'eq',
		choices: [
			{ id: 'eq', label: 'Equals' },
			{ id: 'ne', label: 'Not equals' },
			{ id: 'gt', label: 'Greater than' },
			{ id: 'gte', label: 'Greater than or equal' },
			{ id: 'lt', label: 'Less than' },
			{ id: 'lte', label: 'Less than or equal' },
			{ id: 'contains', label: 'Contains' },
			{ id: 'regex', label: 'Matches regex' },
		],
		disableAutoExpression: true,
	}
}

/** Pick an entity attribute, or the state itself when blank */
export function AttributePicker(): CompanionInputFieldTextInput<'attribute'> {
	return {
		type: 'textinput',
		label: 'Attribute (blank = state)',
		id: 'attribute',
		default: '',
	}
}
