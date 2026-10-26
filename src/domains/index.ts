import { climateDomain } from './climate.js'
import { coverDomain } from './cover.js'
import { fanDomain } from './fan.js'
import { lockDomain } from './lock.js'
import { mediaPlayerDomain } from './media_player.js'
import { numberDomain } from './number.js'
import { selectDomain } from './select.js'
import { valveDomain } from './valve.js'
import { binarySensorDomain } from './binary_sensor.js'
import { buttonDomain } from './button.js'
import { genericDomain } from './generic.js'
import { groupDomain } from './group.js'
import { inputBooleanDomain } from './input_boolean.js'
import { inputSelectDomain } from './input_select.js'
import { lightDomain } from './light.js'
import { sceneDomain } from './scene.js'
import { scriptDomain } from './script.js'
import { switchDomain } from './switch.js'
import type { DomainDefinition } from './types.js'

// Order determines the order of preset sections

export const ALL_DOMAINS: DomainDefinition<any, any>[] = [
	switchDomain,
	inputBooleanDomain,
	lightDomain,
	scriptDomain,
	buttonDomain,
	sceneDomain,
	groupDomain,
	inputSelectDomain,
	binarySensorDomain,
	coverDomain,
	climateDomain,
	mediaPlayerDomain,
	lockDomain,
	fanDomain,
	valveDomain,
	numberDomain,
	selectDomain,
	genericDomain,
]

/**
 * Domains to register definitions for. A domain is only registered once at least one entity of it exists,
 * which keeps the number of definitions down on large installs. While the entities are not yet known
 * (`presentDomains` is undefined) everything is registered so existing buttons keep resolving.
 */

export function activeDomains(presentDomains: Set<string> | undefined): DomainDefinition<any, any>[] {
	return ALL_DOMAINS.filter(
		(d) =>
			d.alwaysRegister ||
			!presentDomains ||
			presentDomains.has(d.id) ||
			d.alsoDomains?.some((a) => presentDomains.has(a)),
	)
}
