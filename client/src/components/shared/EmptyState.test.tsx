import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
  it('renders description', () => {
    render(<EmptyState title="T" description="D" />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});
