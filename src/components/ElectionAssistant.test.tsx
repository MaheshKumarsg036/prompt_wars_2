import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ElectionAssistant from './ElectionAssistant';

// Mock fetch for the API calls
global.fetch = vi.fn((url: string) => {
  if (url === '/api/news') {
    return Promise.resolve({
      json: () => Promise.resolve([{ id: 1, title: 'Test News', source: 'Test', time: '1h' }])
    });
  }
  if (url === '/api/chat') {
    return Promise.resolve({
      json: () => Promise.resolve({ response: 'Test Gemini Response' })
    });
  }
  if (url === '/api/vote') {
    return Promise.resolve({
      json: () => Promise.resolve({ percentage: 60, atmosphere: 'Test atmosphere' })
    });
  }
  return Promise.reject(new Error('not found'));
}) as unknown as typeof fetch;

describe('ElectionAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the main layout', async () => {
    render(<ElectionAssistant />);
    expect(screen.getByText('Smart Election Hub')).toBeInTheDocument();
    
    // Wait for news to load
    await waitFor(() => {
      expect(screen.getByText('Test News')).toBeInTheDocument();
    });
  });

  it('handles chat submission', async () => {
    render(<ElectionAssistant />);
    
    const input = screen.getByPlaceholderText('Ask Gemini...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    const submitBtn = input.nextElementSibling;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Test Gemini Response')).toBeInTheDocument();
    });
  });

  it('handles voting submission', async () => {
    render(<ElectionAssistant />);
    
    const yesBtn = screen.getByText('Yes');
    fireEvent.click(yesBtn);

    await waitFor(() => {
      expect(screen.getByText('Test atmosphere')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  it('handles negative voting submission', async () => {
    render(<ElectionAssistant />);
    
    const notYetBtn = screen.getByText('Not Yet');
    fireEvent.click(notYetBtn);

    await waitFor(() => {
      expect(screen.getByText('Test atmosphere')).toBeInTheDocument();
    });
  });

  it('handles chat submission error gracefully', async () => {
    // Override the mock to fail for this test
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/chat') return Promise.reject(new Error('Network error'));
      if (url === '/api/news') {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, title: 'Test News', source: 'Test', time: '1h' }])
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    render(<ElectionAssistant />);
    
    const input = screen.getByPlaceholderText('Ask Gemini...');
    fireEvent.change(input, { target: { value: 'Trigger error' } });
    
    const submitBtn = input.nextElementSibling;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Error connecting to AI service.')).toBeInTheDocument();
    });
  });
});
