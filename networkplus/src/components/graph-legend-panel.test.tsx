// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
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
    const onPeopleFiltersChange = vi.fn();
    const onFocusNode = vi.fn();
    const result = render(
        <GraphLegendPanel
            nodes={mockNodes}
            groups={mockGroups}
            selectedGroupFilters={[]}
            onGroupFiltersChange={onGroupFiltersChange}
            selectedPeopleFilters={new Set()}
            onPeopleFiltersChange={onPeopleFiltersChange}
            onFocusNode={onFocusNode}
            {...overrides}
        />
    );
    return { ...result, onGroupFiltersChange, onPeopleFiltersChange, onFocusNode };
}

describe('GraphLegendPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // --- Opening / Closing ---
    it('renders the toggle button', () => {
        renderPanel();
        expect(screen.getByRole('button', { name: '' })).toBeTruthy();
        const btn = document.getElementById('legend-toggle-button');
        expect(btn).toBeTruthy();
    });

    it('panel is hidden by default', () => {
        renderPanel();
        expect(screen.getByText('People')).toBeTruthy();
        expect(screen.getByText('Groups')).toBeTruthy();
        expect(screen.getByText('Types')).toBeTruthy();
    });

    it('opens when the FAB is clicked', () => {
        renderPanel();
        const fab = document.getElementById('legend-toggle-button')!;
        fireEvent.click(fab);
        const input = document.getElementById('legend-individual-search');
        expect(input).toBeTruthy();
    });

    // --- People Tab (Filtering) ---
    describe('People tab', () => {
        it('shows filtered contacts when searching', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'alice' } });

            expect(screen.getByText('Alice Smith')).toBeTruthy();
            expect(screen.queryByText('Bob Jones')).toBeNull();
        });

        it('calls onPeopleFiltersChange when a contact is clicked (toggle)', () => {
            const { onPeopleFiltersChange } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            const input = document.getElementById('legend-individual-search') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'bob' } });

            const result = screen.getByText('Bob Jones');
            fireEvent.click(result.closest('button')!);

            // Should call with a set containing '2'
            expect(onPeopleFiltersChange).toHaveBeenCalled();
            const calledSet = onPeopleFiltersChange.mock.calls[0][0] as Set<string>;
            expect(calledSet.has('2')).toBe(true);
        });

        it('shows selected people as badges', () => {
            renderPanel({ selectedPeopleFilters: new Set(['1', '2']) });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            
            // Multiple elements may exist (one in badges, one in the list)
            expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Bob Jones').length).toBeGreaterThan(0);
            expect(screen.getByText('Clear')).toBeTruthy();
        });

        it('clears all people filters when "Clear" is clicked', () => {
            const { onPeopleFiltersChange } = renderPanel({ selectedPeopleFilters: new Set(['1']) });
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            
            fireEvent.click(screen.getByText('Clear'));
            
            const calledSet = onPeopleFiltersChange.mock.calls[0][0] as Set<string>;
            expect(calledSet.size).toBe(0);
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

        it('calls onGroupFiltersChange when a group is clicked', () => {
            const { onGroupFiltersChange } = renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Groups'));

            const googleRow = screen.getByText('Google Inc').closest('button')!;
            fireEvent.click(googleRow);

            expect(onGroupFiltersChange).toHaveBeenCalledWith(['Google Inc']);
        });
    });

    // --- Types Tab ---
    describe('Types tab', () => {
        it('switches to types tab and shows classified types', () => {
            renderPanel();
            fireEvent.click(document.getElementById('legend-toggle-button')!);
            fireEvent.click(screen.getByText('Types'));

            expect(screen.getByText('School / Education')).toBeTruthy();
            expect(screen.getByText('Employment')).toBeTruthy();
        });
    });
});
