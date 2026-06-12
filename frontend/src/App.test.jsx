/**
 * Basic frontend tests for React components
 * Run with: npm test
 */

import { render, screen, waitFor } from '@testing-library/react';
import GoldSystemApp from './App';

describe('Gold System Frontend', () => {
  
  // Mock API response
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        timestamp: '2025-01-15T14:32:00Z',
        bias: 'LONG',
        long_score: 3,
        short_score: 1,
        long_signals: ['DXY', 'TLT', 'VIX'],
        short_signals: ['SPX'],
        instruments: {
          DXY: { symbol: 'DX/USD', price: 103.5, ma: 102.0, trend: 'bear', change_pct: 0.5, last_updated: '2025-01-15T14:32:00Z' },
          TLT: { symbol: 'TLT', price: 92.3, ma: 91.0, trend: 'bull', change_pct: 0.3, last_updated: '2025-01-15T14:32:00Z' },
          VIX: { symbol: 'VIX', price: 22.5, trend: 'unknown', change_pct: 1.2, last_updated: '2025-01-15T14:32:00Z' },
          SPX: { symbol: 'SPX500', price: 4900, ma: 5000, trend: 'bear', change_pct: -0.2, last_updated: '2025-01-15T14:32:00Z' },
          GOLD: { symbol: 'XAU/USD', price: 2070.5, ma: 2050.0, trend: 'bull', change_pct: 0.8, last_updated: '2025-01-15T14:32:00Z' },
        },
        session: { active: true, name: 'OVERLAP', london: true, ny: true, overlap: true, utc_hour: 15 }
      })
    })
  );

  test('renders app header', () => {
    render(<GoldSystemApp />);
    expect(screen.getByText(/GOLD SYSTEM/i)).toBeInTheDocument();
    expect(screen.getByText(/v5/i)).toBeInTheDocument();
  });

  test('renders all tabs', () => {
    render(<GoldSystemApp />);
    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan Long/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan Short/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Glossaire/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discipline/i })).toBeInTheDocument();
  });

  test('fetches macro data on mount', async () => {
    render(<GoldSystemApp />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/macro'),
        expect.any(Object)
      );
    });
  });

  test('displays bias correctly', async () => {
    render(<GoldSystemApp />);
    await waitFor(() => {
      expect(screen.getByText(/LONG BIAS/i)).toBeInTheDocument();
    });
  });

  test('displays session info', async () => {
    render(<GoldSystemApp />);
    await waitFor(() => {
      expect(screen.getByText(/OVERLAP/i)).toBeInTheDocument();
    });
  });

  test('displays instruments', async () => {
    render(<GoldSystemApp />);
    await waitFor(() => {
      expect(screen.getByText(/DXY/)).toBeInTheDocument();
      expect(screen.getByText(/TLT/)).toBeInTheDocument();
      expect(screen.getByText(/VIX/)).toBeInTheDocument();
      expect(screen.getByText(/SPX/)).toBeInTheDocument();
    });
  });
});
