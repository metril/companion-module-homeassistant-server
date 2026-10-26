import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['src/**/*.spec.ts'],
		// Specs are independent and fast: run files in parallel across all cores
		pool: 'threads',
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.spec.ts', 'src/__mocks__/**'],
		},
	},
})
