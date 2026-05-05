import { SomeCompanionConfigField } from '@companion-module/base'
import type { HassEntity } from 'home-assistant-js-websocket'
import {
	COMMON_HA_DOMAINS,
	DEFAULT_INCLUDED_DOMAINS,
	type FilterBreakdown,
	perDomainCountsFromState,
} from './filter.js'

export type DeviceConfig = {
	url?: string
	ignore_certificates?: boolean
	enable_variables?: boolean
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
const HIGH_VOLUME_THRESHOLD = 200
const FILTER_VISIBLE = '$(options:enable_variables)'

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

function fmt(n: number): string {
	return n.toLocaleString('en-US')
}

function buildExplainer(state: HassEntity[], lastCounts: LastFilterCounts | undefined): string {
	if (state.length === 0 || !lastCounts?.breakdown) {
		return (
			'<b>Variable filtering.</b> Save your settings once to see live counts and a per-domain ' +
			'breakdown of your Home Assistant install here. The fields below combine with <b>AND</b> — ' +
			'leave any blank to skip that layer. Patterns support <code>*</code> (any chars), ' +
			'<code>?</code> (one char), and comma separation.'
		)
	}

	const breakdown = lastCounts.breakdown
	const attrsLabel = lastCounts.exposeAttributes ? 'on' : 'off'
	const dropFromTotal = breakdown.totalCount - breakdown.afterDomains
	const dropFromDomains = breakdown.afterDomains - breakdown.afterIncludes
	const dropFromIncludes = breakdown.afterIncludes - breakdown.afterExcludes

	const summary =
		'<b>Summary</b>' +
		'<table>' +
		`<tr><td>HA entities&nbsp;&nbsp;</td><td><b>${fmt(breakdown.totalCount)}</b></td></tr>` +
		`<tr><td>Matched by filter&nbsp;&nbsp;</td><td><b>${fmt(lastCounts.entitiesMatched)}</b></td></tr>` +
		`<tr><td>Variables registered&nbsp;&nbsp;</td><td><b>${fmt(lastCounts.variablesCount)}</b></td></tr>` +
		`<tr><td>Attributes&nbsp;&nbsp;</td><td>${attrsLabel}</td></tr>` +
		'</table>'

	const perLayer =
		'<b>Per-layer impact</b>' +
		'<table>' +
		`<tr><td>Total&nbsp;&nbsp;</td><td>${fmt(breakdown.totalCount)}</td><td></td></tr>` +
		`<tr><td>After domain filter&nbsp;&nbsp;</td><td>${fmt(breakdown.afterDomains)}</td><td><i>(−${fmt(dropFromTotal)})</i></td></tr>` +
		`<tr><td>After include patterns&nbsp;&nbsp;</td><td>${fmt(breakdown.afterIncludes)}</td><td><i>(−${fmt(dropFromDomains)})</i></td></tr>` +
		`<tr><td>After exclude patterns&nbsp;&nbsp;</td><td>${fmt(breakdown.afterExcludes)}</td><td><i>(−${fmt(dropFromIncludes)})</i></td></tr>` +
		'</table>'

	const sortedDomains = Object.entries(breakdown.perDomainCounts).sort((a, b) => b[1] - a[1])
	const top = sortedDomains.slice(0, TOP_DOMAINS_TO_SHOW)
	const remainder = sortedDomains.length - top.length
	const domainRows = top
		.map(([d, c]) => {
			const tag = c >= HIGH_VOLUME_THRESHOLD ? '<i>high volume</i>' : ''
			return `<tr><td>${escapeHtml(d)}&nbsp;&nbsp;</td><td>${fmt(c)}</td><td>&nbsp;&nbsp;${tag}</td></tr>`
		})
		.join('')
	const moreRow = remainder > 0 ? `<i>…and ${remainder} more domain${remainder === 1 ? '' : 's'}</i>` : ''
	const topDomains = '<b>Top domains in your HA</b>' + '<table>' + domainRows + '</table>' + moreRow

	const howItWorks =
		'<b>How the filter works</b>' +
		'<ul>' +
		'<li>Fields below combine with <b>AND</b>. Leave any blank to skip that layer.</li>' +
		'<li>Patterns: <code>*</code> (any chars), <code>?</code> (one char), comma-separated.</li>' +
		'<li>Custom domains not listed below: use Include patterns (e.g. <code>my_custom_domain.*</code>).</li>' +
		'</ul>'

	return summary + '<br>' + perLayer + '<br>' + topDomains + '<br>' + howItWorks
}

function buildDomainChoices(state: HassEntity[]): { id: string; label: string }[] {
	if (state.length === 0) return COMMON_HA_DOMAINS
	const counts = perDomainCountsFromState(state)
	return COMMON_HA_DOMAINS.map((d) => {
		const n = counts[d.id] ?? 0
		if (n === 0) return { id: d.id, label: `${d.label} (none)` }
		if (n >= HIGH_VOLUME_THRESHOLD) return { id: d.id, label: `${d.label} (${fmt(n)} — high volume)` }
		return { id: d.id, label: `${d.label} (${fmt(n)})` }
	})
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
			type: 'checkbox',
			id: 'enable_variables',
			label: 'Expose Home Assistant entities as Companion variables',
			width: 12,
			default: true,
			disableAutoExpression: true,
			tooltip: 'Off = no entity variables created. Feedbacks, actions, and presets still work.',
		},
		{
			type: 'static-text',
			id: 'filter_help',
			label: 'Variable filtering',
			width: 12,
			value: buildExplainer(state, lastCounts),
			isVisibleExpression: FILTER_VISIBLE,
		},
		{
			type: 'multidropdown',
			id: 'include_domains',
			label: 'Include domains (empty = all)',
			width: 12,
			default: DEFAULT_INCLUDED_DOMAINS,
			choices: buildDomainChoices(state),
			minSelection: 0,
			isVisibleExpression: FILTER_VISIBLE,
		},
		{
			type: 'textinput',
			id: 'include_patterns',
			label: 'Include patterns (glob, comma-separated, empty = no name filter)',
			width: 12,
			default: '',
			tooltip: 'Examples: *kitchen*  |  living_room_*, *_battery  |  light.*, sensor.*battery*',
			isVisibleExpression: FILTER_VISIBLE,
		},
		{
			type: 'textinput',
			id: 'exclude_patterns',
			label: 'Exclude patterns (glob, comma-separated)',
			width: 12,
			default: '',
			tooltip: 'Examples: *debug*, *.test_*  — entities matching ANY of these are dropped',
			isVisibleExpression: FILTER_VISIBLE,
		},
		{
			type: 'checkbox',
			id: 'expose_attributes',
			label: 'Expose entity attributes as Companion variables (warning: ~10× more variables)',
			width: 12,
			default: false,
			isVisibleExpression: FILTER_VISIBLE,
		},
	]
}
