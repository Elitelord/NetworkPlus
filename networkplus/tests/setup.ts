import { vi } from 'vitest';

// Mock ResizeObserver for components that use it (like cmdk / MagicSearch)
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Optional: Mock other browser APIs if needed in the future
// vi.stubGlobal('IntersectionObserver', class { ... });
