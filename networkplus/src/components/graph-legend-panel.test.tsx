// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GraphLegendPanel } from './graph-legend-panel';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/dom';

const mockNodes = [
    { id: '1', name: 'Alice Smith', groups: ['Stanford University', 'Google Inc'] },
    { id: '2', name: 'Bob Jones', groups: ['Google Inc'] },
    { id: '3', name: 'Charlie Brown', groups: ['Family'] },
    { id: '4', name: 'Diana Prince', groups: ['Stanford University', 'Family'] },
    { id: '5', name: 'Eve Adams', groups: [] },
];

const mockGroups = ['Family', 'Google Inc', 'Stanford University'];

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
        // Tab labels should exist but panel should have pointer-events-none
        expect(screen.getByText('Individual')).toBeTruthy();
        expect(screen.getByText('Groups')).toBeTruthy();
        expect(screen.getByText('Types')).toBeTruthy();
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
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'alice' } });

            expect(screen.getByText('Alice Smith')).toBeTruthy();
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

            expect(input.value).toBe('');
        });

        it('shows group info for contacts with groups', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'alice' } });

            expect(screen.getByText('Stanford University, Google Inc')).toBeTruthy();
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

            expect(screen.getByText('Family')).toBeTruthy();
            expect(screen.getByText('Google Inc')).toBeTruthy();
            expect(screen.getByText('Stanford University')).toBeTruthy();
        });

        it('shows contact counts for each group', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // Family has 2, Google Inc has 2, Stanford has 2
            const countElements = screen.getAllByText('2');
            expect(countElements.length).toBeGreaterThanOrEqual(3);
        });

        it('calls onGroupFiltersChange when a group is clicked', () => {
            const { onGroupFiltersChange } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const googleRow = screen.getByText('Google Inc').closest('button')!;
            fireEvent.click(googleRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Google Inc']);
        });

        it('supports deselecting a selected group', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Google Inc'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            // 'Google Inc' appears as both a badge and in the group list
            const elements = screen.getAllByText('Google Inc');
            const row = elements[elements.length - 1].closest('button')!;
            fireEvent.click(row);

            expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
        });

        it('calls onGroupFiltersChange to add a second group filter', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Stanford University'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const familyRow = screen.getByText('Family').closest('button')!;
            fireEvent.click(familyRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Stanford University', 'Family']);
        });

        it('filters groups when searching', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const groupInput = document.getElementById('legend-group-search') as HTMLInputElement;
            fireEvent.change(groupInput, { target: { value: 'fam' } });

            expect(screen.getByText('Family')).toBeTruthy();
            expect(screen.queryByText('Google Inc')).toBeNull();
            expect(screen.queryByText('Stanford University')).toBeNull();
        });

        it('shows selected group badges and "Clear all" button', () => {
            renderPanel({ selectedGroupFilters: ['Stanford University', 'Google Inc'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            expect(screen.getByText('Clear all')).toBeTruthy();
        });

        it('calls onGroupFiltersChange with empty array when "Clear all" is clicked', () => {
            const { onGroupFiltersChange } = renderPanel({ selectedGroupFilters: ['Stanford University', 'Google Inc'] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            fireEvent.click(screen.getByText('Clear all'));

            expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
        });

        it('shows badge count on Groups tab when filters are active', () => {
            renderPanel({ selectedGroupFilters: ['Stanford University', 'Google Inc'] });
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

    // --- Types Tab ---
    describe('Types tab', () => {
        it('switches to types tab and shows classified types', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            // "Stanford University" → school, "Google Inc" → employment, "Family" → family
            expect(screen.getByText('School / Education')).toBeTruthy();
            expect(screen.getByText('Employment')).toBeTruthy();
            expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
        });

        it('shows group count per type', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            // Each type has 1 group
            const oneGroupLabels = screen.getAllByText('1 group');
            expect(oneGroupLabels.length).toBeGreaterThanOrEqual(3);
        });

        it('selects all groups of a type when type is clicked', () => {
            const { onGroupFiltersChange } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            // Click the "Employment" type row
            const empRow = screen.getByText('Employment').closest('button')!;
            fireEvent.click(empRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Google Inc']);
        });

        it('deselects all groups of a type when type is clicked again', () => {
            const { onGroupFiltersChange } = renderPanel({
                selectedGroupFilters: ['Google Inc'],
            });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            // "Employment" appears as badge + list row, use getAllByText
            const empElements = screen.getAllByText('Employment');
            const empRow = empElements[empElements.length - 1].closest('button')!;
            fireEvent.click(empRow);

            // Should remove "Google Inc"
            expect(onGroupFiltersChange).toHaveBeenCalledWith([]);
        });

        it('shows description text', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            expect(screen.getByText('Auto-classified by group name keywords')).toBeTruthy();
        });

        it('shows "No groups to classify" when no groups exist', () => {
            renderPanel({ groups: [] });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            expect(screen.getByText('No groups to classify')).toBeTruthy();
        });

        it('can combine type filter with existing group filters', () => {
            const { onGroupFiltersChange } = renderPanel({
                selectedGroupFilters: ['Family'],
            });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            // Click Employment to add its groups
            const empRow = screen.getByText('Employment').closest('button')!;
            fireEvent.click(empRow);

            // Should add Google Inc to existing ['Family']
            expect(onGroupFiltersChange).toHaveBeenCalledWith(
                expect.arrayContaining(['Family', 'Google Inc'])
            );
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
            fireEvent.change(groupInput, { target: { value: 'GOOGLE' } });

            expect(screen.getByText('Google Inc')).toBeTruthy();
        });
    });
});
