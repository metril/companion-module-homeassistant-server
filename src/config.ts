import { SomeCompanionConfigField } from '@companion-module/base'
import type { HassEntity } from 'home-assistant-js-websocket'
import { COMMON_HA_DOMAINS, DEFAULT_INCLUDED_DOMAINS, type FilterBreakdown } from './filter.js'

export type DeviceConfig = {
	url?: string
	ignore_certificates?: boolean
	include_domains?: string[]
	include_patterns?: string
	exclude_patterns?: string
	expose_attributes?: boolean
}

export type DeviceSecrets = {
	access_token?: string
}

export type LastFilterCounts = {
	entitiesMatched: number
	variablesCount: number
	exposeAttributes: boolean
	breakdown?: FilterBreakdown
}

const TOP_DOMAINS_TO_SHOW = 15

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case '&':
				return '&amp;'
			case '<':
				return '&lt;'
			case '>':
				return '&gt;'
			case '"':
				return '&quot;'
			default:
				return '&#39;'
		}
	})
}

function buildExplainer(state: HassEntity[], lastCounts: LastFilterCounts | undefined): string {
	const baseHelp =
		'The three filter fields below combine with <b>AND</b> — leave a field blank to skip that layer. ' +
		'Patterns support <code>*</code> (any chars), <code>?</code> (one char), and comma separation. ' +
		'After saving, the per-layer breakdown is logged and the live count is also at ' +
		'<code>$(homeassistant-server:_meta.variables_count)</code>.<br>' +
		'If your HA install uses a custom integration with a domain not listed below, leave domains ' +
		'empty and use Include patterns (e.g. <code>my_custom_domain.*</code>).'

	if (state.length === 0 || !lastCounts?.breakdown) {
		return (
			'<b>Variable filtering.</b> Home Assistant can publish thousands of entities. Without filtering, ' +
			'this module creates a Companion variable for every entity (and every attribute), which can ' +
			'freeze the variables panel.<br><br>' +
			baseHelp
		)
	}

	const breakdown = lastCounts.breakdown
	const perDomain = Object.entries(breakdown.perDomainCounts).sort((a, b) => b[1] - a[1])
	const top = perDomain.slice(0, TOP_DOMAINS_TO_SHOW)
	const remainder = perDomain.length - top.length
	const breakdownText = top.map(([d, c]) => `${escapeHtml(d)}: <b>${c}</b>`).join(', ')
	const moreText = remainder > 0 ? ` <i>and ${remainder} more domain${remainder === 1 ? '' : 's'}</i>` : ''
	const attrsLabel = lastCounts.exposeAttributes ? 'on' : 'off'

	return (
		`Home Assistant published <b>${breakdown.totalCount}</b> entities. ` +
		`Your last-saved filter exposed <b>${lastCounts.entitiesMatched}</b> as Companion variables ` +
		`(<b>${lastCounts.variablesCount}</b> total, attributes ${attrsLabel}).<br>` +
		`Domain breakdown: ${breakdownText}${moreText}<br><br>` +
		baseHelp
	)
}

export function GetConfigFields(
	state: HassEntity[] = [],
	lastCounts: LastFilterCounts | undefined = undefined,
): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'url',
			label: 'Home Assistant Url',
			width: 6,
		},
		{
			type: 'checkbox',
			id: 'ignore_certificates',
			label: 'Ignore Certificate Signing',
			width: 6,
			default: false,
		},
		{
			type: 'secret-text',
			id: 'access_token',
			label: 'Access Token',
			width: 6,
		},
		{
			type: 'static-text',
			id: 'filter_help',
			label: 'Variable filtering',
			width: 12,
			value: buildExplainer(state, lastCounts),
		},
		{
			type: 'multidropdown',
			id: 'include_domains',
			label: 'Include domains (empty = all)',
			width: 12,
			default: DEFAULT_INCLUDED_DOMAINS,
			choices: COMMON_HA_DOMAINS,
			minSelection: 0,
		},
		{
			type: 'textinput',
			id: 'include_patterns',
			label: 'Include patterns (glob, comma-separated, empty = no name filter)',
			width: 12,
			default: '',
			tooltip: 'Examples: *kitchen*  |  living_room_*, *_battery  |  light.*, sensor.*battery*',
		},
		{
			type: 'textinput',
			id: 'exclude_patterns',
			label: 'Exclude patterns (glob, comma-separated)',
			width: 12,
			default: '',
			tooltip: 'Examples: *debug*, *.test_*  — entities matching ANY of these are dropped',
		},
		{
			type: 'checkbox',
			id: 'expose_attributes',
			label: 'Expose entity attributes as Companion variables (warning: ~10× more variables)',
			width: 12,
			default: false,
		},
	]
}
