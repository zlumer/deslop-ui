import { describe, it, expect } from 'vitest';
import { getGreeting } from '../src/index';

describe('CLI App', () => {
    it('should generate a correct greeting', () => {
        expect(getGreeting('Alice')).toBe('Hello, Alice!');
        expect(getGreeting('World')).toBe('Hello, World!');
    });
});