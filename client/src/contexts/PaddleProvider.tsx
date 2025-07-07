import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';

interface PaddleContextType {
  paddle: Paddle | null;
  isLoaded: boolean;
  error: string | null;
}

const PaddleContext = createContext<PaddleContextType>({
  paddle: null,
  isLoaded: false,
  error: null,
});

export const usePaddle = () => {
  const context = useContext(PaddleContext);
  if (!context) {
    throw new Error('usePaddle must be used within a PaddleProvider');
  }
  return context;
};

interface PaddleProviderProps {
  children: ReactNode;
}

export const PaddleProvider: React.FC<PaddleProviderProps> = ({ children }) => {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initPaddle = async () => {
      try {
        // Get Paddle configuration from environment variables
        const paddleEnvironment = import.meta.env.VITE_PADDLE_ENVIRONMENT as 'sandbox' | 'production' || 'sandbox';
        const paddleToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

        // Debug environment variables (remove in production)
        console.log('Paddle Environment Variables:', {
          environment: paddleEnvironment,
          hasToken: !!paddleToken,
          tokenPrefix: paddleToken?.substring(0, 5) + '...',
        });

        if (!paddleToken) {
          const errorMsg = 'Paddle client token is not configured. Please set VITE_PADDLE_CLIENT_TOKEN environment variable.';
          console.warn('[PaddleProvider]', errorMsg);
          setError(errorMsg);
          setIsLoaded(false);
          return; // Don't initialize Paddle without token
        }

        // Validate token format
        if (!paddleToken.startsWith('test_') && !paddleToken.startsWith('live_')) {
          const errorMsg = 'Invalid Paddle client token format. Expected format: test_xxx or live_xxx';
          console.error('[PaddleProvider]', errorMsg);
          setError(errorMsg);
          setIsLoaded(false);
          return;
        }

        console.log('[PaddleProvider] Initializing Paddle.js...');

        // Initialize Paddle using current best practices
        const paddleInstance = await initializePaddle({
          environment: paddleEnvironment,
          token: paddleToken,
        });

        if (!paddleInstance) {
          throw new Error('Failed to initialize Paddle - no instance returned');
        }

        setPaddle(paddleInstance);
        setIsLoaded(true);
        setError(null);
        console.log('[PaddleProvider] Paddle.js initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Paddle';
        console.error('[PaddleProvider] Initialization error:', err);
        setError(errorMessage);
        setIsLoaded(false);
      }
    };

    initPaddle();
  }, []);

  const value: PaddleContextType = {
    paddle,
    isLoaded,
    error,
  };

  return (
    <PaddleContext.Provider value={value}>
      {children}
    </PaddleContext.Provider>
  );
};

// Hook for checkout functionality
export const usePaddleCheckout = () => {
  const { paddle, isLoaded, error } = usePaddle();

  const openCheckout = (options: {
    items: Array<{
      priceId: string;
      quantity?: number;
    }>;
    customer?: {
      email?: string;
    };
    customData?: Record<string, any>;
    successUrl?: string;
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
  }) => {
    if (!paddle || !isLoaded) {
      throw new Error('Paddle is not loaded yet');
    }

    return paddle.Checkout.open({
      items: options.items,
      customer: options.customer,
      customData: options.customData,
      settings: {
        successUrl: options.successUrl || window.location.origin + '/subscription/success',
      },
    }).then((result) => {
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      return result;
    }).catch((err) => {
      if (options.onError) {
        options.onError(err);
      }
      throw err;
    });
  };

  const getPricePreview = (options: {
    items: Array<{
      priceId: string;
      quantity?: number;
    }>;
    currencyCode?: string;
    discountId?: string;
    address?: {
      countryCode: string;
      postalCode?: string;
    };
  }) => {
    if (!paddle || !isLoaded) {
      throw new Error('Paddle is not loaded yet');
    }

    return paddle.PricePreview({
      items: options.items,
      currencyCode: options.currencyCode,
      discountId: options.discountId,
      address: options.address,
    });
  };

  return {
    openCheckout,
    getPricePreview,
    isLoaded,
    error,
  };
};

export default PaddleProvider;