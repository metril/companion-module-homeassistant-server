import type { CompanionPresetSection } from '@companion-module/base'
import { activeDomains } from './domains/index.js'
import type { DomainContext, PresetsResult } from './domains/types.js'

export function GetPresetsList(ctx: DomainContext, presentDomains: Set<string> | undefined): PresetsResult {
	const sections: CompanionPresetSection[] = []
	const presets: PresetsResult[1] = {}

	for (const domain of activeDomains(presentDomains)) {
		if (!domain.presets) continue
		const [domainSections, domainPresets] = domain.presets(ctx)
		sections.push(...domainSections)
		Object.assign(presets, domainPresets)
	}

	return [sections, presets]
}
