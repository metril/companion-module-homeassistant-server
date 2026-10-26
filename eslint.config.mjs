import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

const customConfig = [
	...baseConfig,

	// Local leftovers (git-excluded) and build output
	{ ignores: ['**/*.root-old/**', 'dist/**', 'pkg/**'] },

	{
		rules: {
			'n/no-missing-import': 'off',
		},
	},

	{
		files: ['**/*.spec.ts', 'src/__mocks__/**', 'vitest.config.mjs'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},
]

export default customConfig
