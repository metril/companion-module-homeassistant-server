import type { CompanionActionDefinitions } from '@companion-module/base'
import { activeDomains } from './domains/index.js'
import type { ButtonActions } from './domains/button.js'
import type { GenericActions } from './domains/generic.js'
import type { GroupActions } from './domains/group.js'
import type { InputBooleanActions } from './domains/input_boolean.js'
import type { InputSelectActions } from './domains/input_select.js'
import type { LightActions } from './domains/light.js'
import type { SceneActions } from './domains/scene.js'
import type { ScriptActions } from './domains/script.js'
import type { SwitchActions } from './domains/switch.js'
import type { DomainContext } from './domains/types.js'

export type ActionsSchema = SwitchActions &
	InputBooleanActions &
	LightActions &
	ScriptActions &
	ButtonActions &
	SceneActions &
	InputSelectActions &
	GroupActions &
	GenericActions

function entityIdsOf(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v !== '')
	return typeof value === 'string' && value !== '' ? [value] : []
}

/**
 * Report the entities each action instance references, so they stay in the (possibly filtered) HA subscription
 * even when the filter would otherwise drop them.
 */

function trackActionEntities(ctx: DomainContext, defs: Record<string, any>): void {
	for (const def of Object.values(defs)) {
		if (!def || !Array.isArray(def.options) || !def.options.some((o: { id: string }) => o.id === 'entity_id')) continue

		def.optionsToMonitorForSubscribe = ['entity_id']
		def.subscribe = (action: { id: string; actionId: string; options: Record<string, unknown> }) => {
			const ids = entityIdsOf(action.options.entity_id)
			if (ids.length > 0) ctx.subs.subscribe(ids, action.id, `action:${action.actionId}`)
			else ctx.subs.unsubscribe(undefined, action.id)
		}
		def.unsubscribe = (action: { id: string }) => ctx.subs.unsubscribe(undefined, action.id)
	}
}

export function GetActionsList(
	ctx: DomainContext,
	presentDomains: Set<string> | undefined,
): CompanionActionDefinitions<ActionsSchema> {
	const actions: Record<string, unknown> = {}
	for (const domain of activeDomains(presentDomains)) {
		if (domain.actions) Object.assign(actions, domain.actions(ctx))
	}
	trackActionEntities(ctx, actions)
	return actions as CompanionActionDefinitions<ActionsSchema>
}
