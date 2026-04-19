import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('shows message from Error', () => {
    render(<ErrorState error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
