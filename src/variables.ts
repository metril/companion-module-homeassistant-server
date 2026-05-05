import type { CompanionVariableDefinitions, InstanceBase, JsonValue } from '@companion-module/base'
import type { HassEntity } from 'home-assistant-js-websocket'
import { LIGHT_MAX_BRIGHTNESS } from './choices.js'
import { HassEntitiesWithChanges } from './hass/entities.js'
import type { HassSchema } from './schema.js'
import { allObservedDomains, type EntityFilter, entityDomain } from './filter.js'

export type HassVariables = {
	[key: `entity.${string}`]: JsonValue | undefined // Because of clash with the below :(
	[key: `entity.${string}.value`]: JsonValue | undefined
	[key: `entity.${string}.brightness`]: number
	[key: `entity.${string}.attributes.${string}`]: JsonValue | undefined
	[key: `_meta.${string}`]: JsonValue | undefined
}

export type VariableCounts = {
	entitiesMatched: number
	variablesCount: number
}

export function updateVariables(
	instance: InstanceBase<HassSchema>,
	state: HassEntitiesWithChanges,
	filter: EntityFilter,
	exposeAttributes: boolean,
): void {
	const variables: Partial<HassVariables> = {}

	const updateForIds = (ids: Set<string>): void => {
		for (const id of ids) {
			const entity = state.entities[id]
			if (!entity) continue
			if (!filter(entity.entity_id)) continue
			updateEntityVariables(variables, entity, exposeAttributes)
		}
	}

	updateForIds(state.added)
	updateForIds(state.contentChanged)
	updateForIds(state.friendlyNameChange)

	// Meta values come from the FULL state — they reflect aggregate counts,
	// not the changed set. Cheap: one pass over the entity list.
	const allEntities = Object.values(state.entities)
	let entitiesMatched = 0
	let exposedVarsCount = 0
	const perDomainCounts: Record<string, number> = {}
	for (const entity of allEntities) {
		const domain = entityDomain(entity.entity_id)
		perDomainCounts[domain] = (perDomainCounts[domain] ?? 0) + 1
		if (!filter(entity.entity_id)) continue
		entitiesMatched++
		exposedVarsCount += countVariablesForEntity(entity, exposeAttributes)
	}
	variables['_meta.entities_total'] = allEntities.length
	variables['_meta.entities_matched'] = entitiesMatched
	// 3 unconditional meta vars + one per observed domain (including unknown ones)
	const metaVarCount = 3 + Object.keys(perDomainCounts).length
	variables['_meta.variables_count'] = exposedVarsCount + metaVarCount
	for (const [domain, count] of Object.entries(perDomainCounts)) {
		variables[`_meta.domain_count.${domain}`] = count
	}

	instance.setVariableValues(variables as any) // TODO - remove this cast
}

function countVariablesForEntity(entity: HassEntity, exposeAttributes: boolean): number {
	let n = 2 // value + name
	if (entity.entity_id.startsWith('light.')) n++ // brightness
	if (exposeAttributes && entity.attributes) {
		n += Object.keys(entity.attributes).length
	}
	return n
}

function updateEntityVariables(variables: Partial<HassVariables>, entity: HassEntity, exposeAttributes: boolean): void {
	variables[`entity.${entity.entity_id}.value`] = entity.state
	variables[`entity.${entity.entity_id}`] = entity.attributes.friendly_name ?? entity.entity_id

	if (entity.entity_id.startsWith('light.')) {
		variables[`entity.${entity.entity_id}.brightness`] = Math.round(
			(100 * (entity.attributes.brightness ?? 0)) / LIGHT_MAX_BRIGHTNESS,
		)
	}

	if (exposeAttributes && entity.attributes) {
		Object.keys(entity.attributes).forEach((attr) => {
			variables[`entity.${entity.entity_id}.attributes.${attr}`] = entity.attributes[attr]
		})
	}
}

export function InitVariables(
	instance: InstanceBase<HassSchema>,
	state: HassEntity[],
	filter: EntityFilter,
	exposeAttributes: boolean,
): VariableCounts {
	const variables: CompanionVariableDefinitions<HassVariables> = {}
	let entitiesMatched = 0
	let variablesCount = 0

	for (const entity of state) {
		if (!filter(entity.entity_id)) continue
		entitiesMatched++

		const name = entity.attributes.friendly_name ?? entity.entity_id
		variables[`entity.${entity.entity_id}.value`] = { name: `Entity Value: ${name}` }
		variables[`entity.${entity.entity_id}`] = { name: `Entity Name: ${name}` }
		variablesCount += 2

		if (entity.entity_id.startsWith('light.')) {
			variables[`entity.${entity.entity_id}.brightness`] = { name: `Light Brightness: ${name}` }
			variablesCount++
		}

		if (exposeAttributes && entity.attributes) {
			Object.keys(entity.attributes).forEach((attr) => {
				variables[`entity.${entity.entity_id}.attributes.${attr}`] = {
					name: `Entity Attribute: ${name} - ${attr}`,
				}
				variablesCount++
			})
		}
	}

	// Meta variables — always created, regardless of filter
	variables['_meta.entities_total'] = { name: 'Meta: total HA entities' }
	variables['_meta.entities_matched'] = { name: 'Meta: entities matched by filter' }
	variables['_meta.variables_count'] = { name: 'Meta: Companion variables exposed' }
	variablesCount += 3
	for (const domain of allObservedDomains(state)) {
		variables[`_meta.domain_count.${domain}`] = { name: `Meta: ${domain} entities in HA` }
		variablesCount++
	}

	instance.setVariableDefinitions(variables)
	return { entitiesMatched, variablesCount }
}
