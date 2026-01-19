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
        (global.fetch as any).mockReturnValue(new Promise(() => { })); // Never resolves
        render(<DueSoonList />);
        expect(screen.getByText(/Checking for due contacts/i)).toBeTruthy();
    });

    it('renders contacts when fetch succeeds', async () => {
        const mockContacts = [
            { id: '1', name: 'Alice', lastInteractionAt: '2023-01-01T00:00:00Z' },
            { id: '2', name: 'Bob', lastInteractionAt: '2023-02-01T00:00:00Z' },
        ];
        (global.fetch as any).mockResolvedValue(createFetchResponse(mockContacts));

        render(<DueSoonList />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
            expect(screen.getByText('Bob')).toBeTruthy();
        });
    });

    it('renders empty state when no contacts', async () => {
        (global.fetch as any).mockResolvedValue(createFetchResponse([]));

        render(<DueSoonList />);

        await waitFor(() => {
            expect(screen.getByText(/All caught up/i)).toBeTruthy();
        });
    });
});
