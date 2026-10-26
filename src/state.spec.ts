import { describe, expect, it } from 'vitest'
import { EntitySubscriptions } from './state.js'

describe('EntitySubscriptions', () => {
	it('tracks several entities per instance and replaces them on resubscribe', () => {
		const subs = new EntitySubscriptions()
		subs.subscribe(['light.a', 'light.b'], 'fb1', 'x')
		expect(subs.getFeedbackInstanceIds('light.a')).toEqual(['fb1'])
		subs.subscribe(['light.b'], 'fb1', 'x')
		expect(subs.getFeedbackInstanceIds('light.a')).toEqual([])
		expect(subs.getReferencedEntityIds()).toEqual(new Set(['light.b']))
	})

	it('unsubscribes an instance from everything', () => {
		const subs = new EntitySubscriptions()
		subs.subscribe(['light.a', 'light.b'], 'fb1', 'x')
		subs.unsubscribe(undefined, 'fb1')
		expect(subs.getReferencedEntityIds().size).toBe(0)
	})

	it('keeps action references out of the feedback list but referenced', () => {
		const subs = new EntitySubscriptions()
		subs.subscribe(['switch.a'], 'act1', 'action:set_switch')
		expect(subs.getFeedbackInstanceIds('switch.a')).toEqual([])
		expect(subs.getReferencedEntityIds().has('switch.a')).toBe(true)
	})

	it('reports only newly referenced entities', () => {
		const subs = new EntitySubscriptions()
		const seen: string[] = []
		subs.onNewEntity = (id) => seen.push(id)
		subs.subscribe('light.a', 'fb1', 'x')
		subs.subscribe('light.a', 'fb2', 'x')
		expect(seen).toEqual(['light.a'])
	})
})
