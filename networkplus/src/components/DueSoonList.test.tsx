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
});
