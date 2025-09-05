import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';

// Create a simple mock reducer for testing
const mockAuthReducer = (state: any = { user: null, isAuthenticated: false, isLoading: false, error: null, isInitialized: false, token: null }, _action: any) => state;

// Mock store setup for testing
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: EnhancedStore;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    // Automatically create a store instance if no store was passed in
    store: testStore = configureStore({
      reducer: {
        auth: mockAuthReducer,
        // Add other reducers as needed for tests
      },
      preloadedState,
    }),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children?: React.ReactNode }) {
    return (
      <Provider store={testStore}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  }

  return { store: testStore, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from '@testing-library/react';
export { renderWithProviders as render };
