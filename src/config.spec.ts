import { describe, expect, it } from 'vitest'
import { buildExplainer } from './config.js'

const base = {
	totalCount: 100,
	afterDomains: 80,
	afterIncludes: 70,
	afterExcludes: 60,
	perDomainCounts: { light: 60 },
}
const counts = (afterTaxonomy?: number) => ({
	entitiesMatched: afterTaxonomy ?? 60,
	variablesCount: 10,
	exposeAttributes: false,
	breakdown: { ...base, afterTaxonomy },
})

describe('buildExplainer', () => {
	it('shows the labels/areas/floors row when set', () => {
		const html = buildExplainer(['light.a'], counts(25))
		expect(html).toContain('After labels/areas/floors')
		expect(html).toContain('(−35)')
	})
	it('omits the row when not set', () => {
		expect(buildExplainer(['light.a'], counts())).not.toContain('After labels/areas/floors')
	})
})
