// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MagicSearch } from './magic-search';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/dom';

// Fetch mock
global.fetch = vi.fn();

const mockContacts = [
  { id: '1', name: 'Alice Smith', groups: ['Engineering'], metadata: { inferredBio: 'Tech Lead at Google' } },
  { id: '2', name: 'Bob Jones', groups: ['Sales'], metadata: { inferredBio: 'Sales Manager at Meta' } },
];

describe('MagicSearch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the search button', () => {
    render(<MagicSearch onFocusNode={vi.fn()} />);
    expect(screen.getByText('Ask anything or search...')).toBeTruthy();
  });

  it('opens the dialog when clicked', () => {
    render(<MagicSearch onFocusNode={vi.fn()} />);
    fireEvent.click(screen.getByText('Ask anything or search...'));
    expect(screen.getByPlaceholderText(/e.g. 'Engineers in NYC'/)).toBeTruthy();
  });

  it('displays search results from API', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockContacts,
    });

    render(<MagicSearch onFocusNode={vi.fn()} />);
    fireEvent.click(screen.getByText('Ask anything or search...'));
    
    const input = screen.getByPlaceholderText(/Ask AI/);
    fireEvent.change(input, { target: { value: 'engineers' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Wait for fetch
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
      expect(screen.getByText('Tech Lead at Google')).toBeTruthy();
    });
  });

  it('calls onFocusNode when a result is clicked', async () => {
    const onFocusNode = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockContacts,
    });

    render(<MagicSearch onFocusNode={onFocusNode} />);
    fireEvent.click(screen.getByText('Ask anything or search...'));
    
    const input = screen.getByPlaceholderText(/Ask AI/);
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      const result = screen.getByText('Alice Smith');
      fireEvent.click(result.closest('[role="option"]')!);
    });

    expect(onFocusNode).toHaveBeenCalledWith('1');
  });
});
