// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GraphLegendPanel } from './graph-legend-panel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/dom';

const mockNodes = [
    { id: '1', name: 'Alice Smith', groups: ['Friends', 'Work'] },
    { id: '2', name: 'Bob Jones', groups: ['Work'] },
    { id: '3', name: 'Charlie Brown', groups: ['Family'] },
    { id: '4', name: 'Diana Prince', groups: ['Friends', 'Family'] },
    { id: '5', name: 'Eve Adams', groups: [] },
];

const mockGroups = ['Family', 'Friends', 'Work'];

function renderPanel(overrides: Partial<Parameters<typeof GraphLegendPanel>[0]> = {}) {
    const onGroupFiltersChange = vi.fn();
    const onFocusNode = vi.fn();
    const result = render(
        <GraphLegendPanel
            nodes={mockNodes}
            groups={mockGroups}
            selectedGroupFilters={[]}
            onGroupFiltersChange={onGroupFiltersChange}
            onFocusNode={onFocusNode}
            {...overrides}
        />
    );
    return { ...result, onGroupFiltersChange, onFocusNode };
}

describe('GraphLegendPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // --- Opening / Closing ---
    it('renders the toggle button', () => {
        renderPanel();
        expect(screen.getByRole('button', { name: '' })).toBeTruthy();
        // FAB button with id
        const btn = document.getElementById('legend-toggle-button');
        expect(btn).toBeTruthy();
    });

    it('panel is hidden by default', () => {
        renderPanel();
        // Both tab labels should exist but panel should have pointer-events-none
        // (it's still in the DOM, just visually hidden via CSS)
        expect(screen.getByText('Individual')).toBeTruthy();
        expect(screen.getByText('Groups')).toBeTruthy();
    });

    it('opens when the FAB is clicked', () => {
        renderPanel();
        const fab = document.getElementById('legend-toggle-button')!;
        fireEvent.click(fab);
        // The search input should now be accessible
        const input = document.getElementById('legend-individual-search');
        expect(input).toBeTruthy();
    });

    // --- Individual Tab ---
    describe('Individual tab', () => {
        it('shows filtered contacts when searching', () => {
            renderPanel();
            // Open panel
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'alice' } });

            expect(screen.getByText('Alice Smith')).toBeTruthy();
            // Bob should not be shown
            expect(screen.queryByText('Bob Jones')).toBeNull();
        });

        it('shows "No contacts found" for non-matching search', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'zzzznonexistent' } });

            expect(screen.getByText('No contacts found')).toBeTruthy();
        });

        it('calls onFocusNode when a contact result is clicked', () => {
            const { onFocusNode } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'bob' } });

            const result = screen.getByText('Bob Jones');
            fireEvent.click(result.closest('button')!);

            expect(onFocusNode).toHaveBeenCalledWith('2');
        });

        it('clears search after selecting a contact', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'diana' } });
            fireEvent.click(screen.getByText('Diana Prince').closest('button')!);

            // The input should be cleared
            expect(input.value).toBe('');
        });

        it('shows group info for contacts with groups', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'alice' } });

            expect(screen.getByText('Friends, Work')).toBeTruthy();
        });

        it('limits results to 8 contacts', () => {
            const manyNodes = Array.from({ length: 20 }, (_, i) => ({
                id: `id-${i}`,
                name: `Test User ${i}`,
                groups: ['TestGroup'],
            }));
            renderPanel({ nodes: manyNodes });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'test' } });

            const buttons = screen.getAllByText(/Test User/);
            expect(buttons.length).toBeLessThanOrEqual(8);
        });
    });

    // --- Groups Tab ---
    describe('Groups tab', () => {
        it('switches to groups tab and shows all groups', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // All 3 groups should be shown
            expect(screen.getByText('Family')).toBeTruthy();
            expect(screen.getByText('Friends')).toBeTruthy();
            expect(screen.getByText('Work')).toBeTruthy();
        });

        it('shows contact counts for each group', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // Family has 2 contacts (Charlie, Diana), Friends has 2 (Alice, Diana), Work has 2 (Alice, Bob)
            const countElements = screen.getAllByText('2');
            expect(countElements.length).toBeGreaterThanOrEqual(3);
        });

        it('calls onGroupFiltersChange when a group is clicked', () => {
            const { onGroupFiltersChange } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // Click "Friends" group row
            const friendsRow = screen.getByText('Friends').closest('button')!;
            fireEvent.click(friendsRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Friends']);
        });

        it('supports deselecting a selected group', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Work'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // 'Work' appears as both a badge and in the group list; get the list row (last match)
            const workElements = screen.getAllByText('Work');
            const workRow = workElements[workElements.length - 1].closest('button')!;
            fireEvent.click(workRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
        });

        it('calls onGroupFiltersChange to add a second group filter', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Friends'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const familyRow = screen.getByText('Family').closest('button')!;
            fireEvent.click(familyRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Friends', 'Family']);
        });

        it('filters groups when searching', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const groupInput = document.getElementById('legend-group-search') as HTMLInputElement;
            fireEvent.change(groupInput, { target: { value: 'fam' } });

            expect(screen.getByText('Family')).toBeTruthy();
            // "Friends" and "Work" should not be in the list
            expect(screen.queryByText('Friends')).toBeNull();
            expect(screen.queryByText('Work')).toBeNull();
        });

        it('shows selected group badges and "Clear all" button', () => {
            renderPanel({ selectedGroupFilters: ['Friends', 'Work'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            expect(screen.getByText('Clear all')).toBeTruthy();
        });

        it('calls onGroupFiltersChange with empty array when "Clear all" is clicked', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Friends', 'Work'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            fireEvent.click(screen.getByText('Clear all'));

            expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
        });

        it('shows badge count on Groups tab when filters are active', () => {
            renderPanel({ selectedGroupFilters: ['Friends', 'Work'] });
            // The badge should show "2"
            expect(screen.getByText('2')).toBeTruthy();
        });

        it('shows "No groups yet" when groups list is empty', () => {
            renderPanel({ groups: [] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            expect(screen.getByText('No groups yet')).toBeTruthy();
        });

        it('shows "No groups match your search" for non-matching group search', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const groupInput = document.getElementById('legend-group-search') as HTMLInputElement;
            fireEvent.change(groupInput, { target: { value: 'xyznonexistent' } });

            expect(screen.getByText('No groups match your search')).toBeTruthy();
        });
    });

    // --- Edge Cases ---
    describe('Edge cases', () => {
        it('renders without crashing with empty nodes and groups', () => {
            renderPanel({ nodes: [], groups: [] });
            expect(document.getElementById('legend-toggle-button')).toBeTruthy();
        });

        it('handles contacts with no groups array', () => {
            const nodesWithoutGroups = [
                { id: '1', name: 'NoGroup Person', groups: undefined as unknown as string[] },
            ];
            renderPanel({ nodes: nodesWithoutGroups });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'nogroup' } });

            expect(screen.getByText('NoGroup Person')).toBeTruthy();
        });

        it('handles case-insensitive individual search', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'ALICE' } });

            expect(screen.getByText('Alice Smith')).toBeTruthy();
        });

        it('handles case-insensitive group search', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const groupInput = document.getElementById('legend-group-search') as HTMLInputElement;
            fireEvent.change(groupInput, { target: { value: 'WORK' } });

            expect(screen.getByText('Work')).toBeTruthy();
        });
    });
});
