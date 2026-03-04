// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { DueSoonList } from './DueSoonList';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/dom';

// Mock fetch globally
global.fetch = vi.fn();

function createFetchResponse(data: any) {
    return { ok: true, json: () => Promise.resolve(data) };
}

describe('DueSoonList', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders loading state initially', () => {
        render(<DueSoonList isLoading={true} contacts={[]} />);
        expect(screen.getByText(/Checking contacts/i)).toBeTruthy();
    });

    it('renders contacts when provided', async () => {
        const mockContacts = [
            { id: '1', name: 'Alice', lastInteractionAt: '2023-01-01T00:00:00Z' },
            { id: '2', name: 'Bob', lastInteractionAt: '2023-02-01T00:00:00Z' },
        ];

        render(<DueSoonList contacts={mockContacts} />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
            expect(screen.getByText('Bob')).toBeTruthy();
        });
    });


    it('renders empty state when no contacts', async () => {
        render(<DueSoonList contacts={[]} />);
        expect(screen.getByText(/All caught up/i)).toBeTruthy();
    });

    it('calls onSelect when a contact is clicked', async () => {
        const mockContacts = [
            { id: '1', name: 'Alice', lastInteractionAt: '2023-01-01T00:00:00Z' }
        ];
        const onSelect = vi.fn();

        render(<DueSoonList onSelect={onSelect} contacts={mockContacts} />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
        });

        const card = screen.getByText('Alice').closest('div');
        if (card) {
            card.click();
        }

        expect(onSelect).toHaveBeenCalledWith(mockContacts[0]);
    });

    it('handles heavy load: rendering 1000 contacts without crashing', async () => {
        const mockContacts = Array.from({ length: 1000 }).map((_, i) => ({
            id: `id-${i}`,
            name: `Contact ${i}`,
            lastInteractionAt: new Date(Date.now() - i * 86400000).toISOString()
        }));

        const start = performance.now();
        render(<DueSoonList contacts={mockContacts} />);

        // Wait for at least the first and last to render to ensure it didn't just bail
        await waitFor(() => {
            expect(screen.getByText('Contact 0')).toBeTruthy();
            // In a real virtualized list maybe the last isn't rendered, 
            // but this component currently renders all of them.
            expect(screen.getByText('Contact 999')).toBeTruthy();
        });
        const end = performance.now();

        // It should render 1000 items in a reasonable time (e.g. < 2 seconds in jsdom)
        expect(end - start).toBeLessThan(2000);
    });

    it('handles edge cases: very long names and strange dates', async () => {
        const strangeContacts = [
            { id: '1', name: 'A'.repeat(500), lastInteractionAt: 'invalid-date' },
            { id: '2', name: 'Emoji 🚀🔥 Person 👨‍👩‍👧‍👦', lastInteractionAt: '1970-01-01T00:00:00Z' },
            { id: '3', name: '', lastInteractionAt: '2100-12-31T23:59:59Z' }
        ];

        render(<DueSoonList contacts={strangeContacts} />);

        await waitFor(() => {
            // Long name should be truncated or at least rendered
            expect(screen.getByText('A'.repeat(500))).toBeTruthy();
            expect(screen.getByText('Emoji 🚀🔥 Person 👨‍👩‍👧‍👦')).toBeTruthy();
        });

        // As long as it doesn't throw when parsing 'invalid-date' or extremely future/past dates, it passes.
        expect(true).toBe(true);
    });
});

