import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

const customConfig = [
	...baseConfig,

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
