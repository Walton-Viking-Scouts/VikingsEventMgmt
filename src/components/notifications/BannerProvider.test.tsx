import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { BannerProvider, useBanner } from './BannerProvider';

// Test component that uses the banner context
const TestComponent = () => {
  const { 
    banners, 
    bannerSuccess, 
    bannerError, 
    bannerWarning, 
    bannerInfo, 
    addBanner, 
    removeBanner, 
    removeAllBanners 
  } = useBanner();

  return (
    <div>
      <div data-testid="banner-count">{banners.length}</div>
      
      <button onClick={() => bannerSuccess('Success banner')}>Add Success Banner</button>
      <button onClick={() => bannerError('Error banner')}>Add Error Banner</button>
      <button onClick={() => bannerWarning('Warning banner')}>Add Warning Banner</button>
      <button onClick={() => bannerInfo('Info banner')}>Add Info Banner</button>
      
      <button onClick={() => addBanner({
        type: 'custom',
        message: 'Custom banner',
        actions: [{ label: 'Banner Action', onClick: vi.fn() }],
        persistent: true
      })}>Add Custom Banner</button>
      
      <button onClick={() => removeAllBanners()}>Remove All Banners</button>
      
      <div data-testid="banners">
        {banners.map(banner => (
          <div key={banner.id} data-testid={`banner-${banner.id}`}>
            <span>{banner.message}</span>
            <span data-testid={`type-${banner.id}`}>{banner.type}</span>
            <span data-testid={`persistent-${banner.id}`}>{banner.persistent ? 'true' : 'false'}</span>
            <button onClick={() => removeBanner(banner.id)}>Remove Banner</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Component without provider for error testing
const TestWithoutProvider = () => {
  const { banners } = useBanner();
  return <div>{banners.length}</div>;
};

describe('BannerProvider', () => {
  test('throws error when useBanner is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestWithoutProvider />);
    }).toThrow('useBanner must be used within a BannerProvider');
    
    consoleSpy.mockRestore();
  });

  test('provides banner context values', () => {
    render(
      <BannerProvider>
        <TestComponent />
      </BannerProvider>
    );

    expect(screen.getByTestId('banner-count')).toHaveTextContent('0');
    expect(screen.getByText('Add Success Banner')).toBeInTheDocument();
    expect(screen.getByText('Add Error Banner')).toBeInTheDocument();
  });

  test('shorthand methods add banners with correct types and defaults', () => {
    render(
      <BannerProvider maxBanners={4}>
        <TestComponent />
      </BannerProvider>
    );

    // Add different types of banners
    act(() => {
      screen.getByText('Add Success Banner').click();
      screen.getByText('Add Error Banner').click();
      screen.getByText('Add Warning Banner').click();
      screen.getByText('Add Info Banner').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('4');
    
    // Check messages are displayed (both test component and BannerContainer render them)
    expect(screen.getAllByText('Success banner')).toHaveLength(2);
    expect(screen.getAllByText('Error banner')).toHaveLength(2);
    expect(screen.getAllByText('Warning banner')).toHaveLength(2);
    expect(screen.getAllByText('Info banner')).toHaveLength(2);

    // Check types are correct
    const typeElements = screen.getAllByTestId(/^type-/);
    const types = typeElements.map(el => el.textContent);
    expect(types).toContain('success');
    expect(types).toContain('error');
    expect(types).toContain('warning');
    expect(types).toContain('info');
  });

  test('banner shorthand methods use appropriate persistence defaults', () => {
    render(
      <BannerProvider maxBanners={4}>
        <TestComponent />
      </BannerProvider>
    );

    // Add banners with different types
    act(() => {
      screen.getByText('Add Success Banner').click(); // Should be non-persistent
      screen.getByText('Add Error Banner').click();   // Should be persistent
      screen.getByText('Add Warning Banner').click(); // Should be non-persistent
      screen.getByText('Add Info Banner').click();    // Should be non-persistent
    });

    const persistentElements = screen.getAllByTestId(/^persistent-/);
    const persistentValues = persistentElements.map(el => el.textContent);
    
    // Error banners should be persistent by default, others should not be
    expect(persistentValues).toContain('true');  // Error banner
    expect(persistentValues.filter(val => val === 'false')).toHaveLength(3); // Success, warning, info
  });

  test('addBanner creates banner with generated ID and timestamp', () => {
    render(
      <BannerProvider>
        <TestComponent />
      </BannerProvider>
    );

    act(() => {
      screen.getByText('Add Custom Banner').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('1');
    expect(screen.getAllByText('Custom banner')).toHaveLength(2); // Test component + BannerContainer
    expect(screen.getByText('Banner Action')).toBeInTheDocument();

    // Check that banner has a unique ID (only count test component banners)
    const bannerElements = screen.getAllByTestId(/^banner-/).filter(el => 
      el.parentElement?.getAttribute('data-testid') === 'banners'
    );
    expect(bannerElements).toHaveLength(1);
    
    const bannerId = bannerElements[0].getAttribute('data-testid')?.replace('banner-', '');
    expect(bannerId).toBeTruthy();
    expect(bannerId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });

  test('removeBanner removes specific banner', () => {
    render(
      <BannerProvider>
        <TestComponent />
      </BannerProvider>
    );

    // Add multiple banners
    act(() => {
      screen.getByText('Add Success Banner').click();
      screen.getByText('Add Error Banner').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('2');

    // Remove one banner
    const removeButton = screen.getAllByText('Remove Banner')[0];
    act(() => {
      removeButton.click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('1');
  });

  test('removeAllBanners clears all banners', () => {
    render(
      <BannerProvider>
        <TestComponent />
      </BannerProvider>
    );

    // Add multiple banners
    act(() => {
      screen.getByText('Add Success Banner').click();
      screen.getByText('Add Error Banner').click();
      screen.getByText('Add Warning Banner').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('3');

    // Remove all
    act(() => {
      screen.getByText('Remove All Banners').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('0');
  });

  test('respects maxBanners limit', () => {
    render(
      <BannerProvider maxBanners={2}>
        <TestComponent />
      </BannerProvider>
    );

    // Add more banners than the limit
    act(() => {
      screen.getByText('Add Success Banner').click();
      screen.getByText('Add Error Banner').click();
      screen.getByText('Add Warning Banner').click();
      screen.getByText('Add Info Banner').click();
    });

    // Should only keep the last 2 banners
    expect(screen.getByTestId('banner-count')).toHaveTextContent('2');
    
    // Should have the last two banners (Warning and Info)
    expect(screen.queryAllByText('Success banner')).toHaveLength(0);
    expect(screen.queryAllByText('Error banner')).toHaveLength(0);
    expect(screen.getAllByText('Warning banner')).toHaveLength(2); // container + test component
    expect(screen.getAllByText('Info banner')).toHaveLength(2);
  });

  test('renders BannerContainer with banners at top by default', () => {
    const { container } = render(
      <BannerProvider>
        <div data-testid="main-content">Main Content</div>
        <TestComponent />
      </BannerProvider>
    );

    // Add a banner
    act(() => {
      screen.getByText('Add Success Banner').click();
    });

    // BannerContainer should be rendered before the children
    const bannerContainer = container.querySelector('[aria-label="System notifications"]');
    expect(bannerContainer).toBeInTheDocument();
    expect(bannerContainer?.className).toContain('mb-4'); // Top positioning
    
    // Main content should come after
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  test('can be configured with bottom position', () => {
    const { container } = render(
      <BannerProvider position="bottom">
        <TestComponent />
      </BannerProvider>
    );

    // Add a banner
    act(() => {
      screen.getByText('Add Success Banner').click();
    });

    const bannerContainer = container.querySelector('[aria-label="System notifications"]');
    expect(bannerContainer?.className).toContain('mt-4'); // Bottom positioning
  });

  test('banners have unique IDs when added rapidly', () => {
    render(
      <BannerProvider>
        <TestComponent />
      </BannerProvider>
    );

    // Add multiple banners quickly
    act(() => {
      screen.getByText('Add Info Banner').click();
      screen.getByText('Add Info Banner').click();
      screen.getByText('Add Info Banner').click();
    });

    expect(screen.getByTestId('banner-count')).toHaveTextContent('3');

    // All should have unique IDs
    const bannerElements = screen.getAllByTestId(/^banner-/).filter(el =>
      el.parentElement?.getAttribute('data-testid') === 'banners'
    );
    const bannerIds = bannerElements.map(el => 
      el.getAttribute('data-testid')?.replace('banner-', '')
    );
    
    const uniqueIds = new Set(bannerIds);
    expect(uniqueIds.size).toBe(3);
  });
});