import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MembersList from '../MembersList.jsx';

// Mock the API module
vi.mock('../../services/api.js', () => ({
  getListOfMembers: vi.fn(),
}));

// Mock the auth module  
vi.mock('../../services/auth.js', () => ({
  getToken: vi.fn(() => 'mock-token'),
}));

// Mock platform detection
vi.mock('../../utils/platform.js', () => ({
  isMobileLayout: vi.fn(() => false),
}));

describe('MembersList', () => {
  const mockSections = [
    { sectionid: 1, sectionname: 'Beavers', sectiontype: 'beavers' },
    { sectionid: 2, sectionname: 'Cubs', sectiontype: 'cubs' },
  ];

  const mockMembers = [
    {
      scoutid: 1,
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      phone: '123-456-7890',
      sections: ['Beavers'],
      patrol: 'Red Patrol',
      rank: 'Scout',
      date_of_birth: '2010-05-15',
    },
    {
      scoutid: 2,
      firstname: 'Jane',
      lastname: 'Smith',
      email: 'jane.smith@example.com',
      phone: '098-765-4321',
      sections: ['Cubs', 'Beavers'],
      patrol: 'Blue Patrol',
      rank: 'Senior Scout',
      date_of_birth: '2009-03-20',
    },
  ];

  const mockOnBack = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import and mock the API function
    const { getListOfMembers } = await import('../../services/api.js');
    vi.mocked(getListOfMembers).mockResolvedValue(mockMembers);
  });

  it('renders loading screen initially', () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    expect(screen.getByText('Loading members...')).toBeInTheDocument();
  });

  it('displays members count after loading', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Members (2)')).toBeInTheDocument();
    });
  });

  it('displays section information', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Members from selected sections: Beavers, Cubs')).toBeInTheDocument();
    });
  });

  it('shows member names after loading', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays member email addresses', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
    });
  });

  it('shows search input', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search members by name, email, or section...')).toBeInTheDocument();
    });
  });

  it('filters members when searching', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search members by name, email, or section...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    // John should still be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // Jane should be filtered out  
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('shows back button', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });
  });

  it('calls onBack when back button is clicked', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Dashboard');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('shows export button', async () => {
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    // Mock API to reject
    const { getListOfMembers } = await import('../../services/api.js');
    vi.mocked(getListOfMembers).mockRejectedValue(new Error('Failed to load members'));
    
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Error Loading Members')).toBeInTheDocument();
      expect(screen.getByText('Failed to load members')).toBeInTheDocument();
    });
  });

  it('shows retry and back buttons on error', async () => {
    // Mock API to reject
    const { getListOfMembers } = await import('../../services/api.js');
    vi.mocked(getListOfMembers).mockRejectedValue(new Error('API Error'));
    
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });
  });

  it('displays empty state when no members found', async () => {
    // Mock API to return empty array
    const { getListOfMembers } = await import('../../services/api.js');
    vi.mocked(getListOfMembers).mockResolvedValue([]);
    
    render(<MembersList sections={mockSections} onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Members (0)')).toBeInTheDocument();
      expect(screen.getByText('No members found')).toBeInTheDocument();
    });
  });
});