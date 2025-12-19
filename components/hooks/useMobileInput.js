import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook for handling mobile input
 */
export function useMobileInput(isMobile, selectedCell, handleCellInput) {
  const mobileInputRef = useRef(null);
  const isProcessingRef = useRef(false);

  const handleMobileInput = useCallback((e) => {
    // Prevent double-processing (especially important for Brave browser on Android)
    if (isProcessingRef.current) {
      return;
    }

    try {
      const value = e.target.value;
      if (value === '') {
        handleCellInput(0);
        return;
      }

      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        isProcessingRef.current = true;
        handleCellInput(num).finally(() => {
          // Clear the processing flag after input is handled
          isProcessingRef.current = false;
        });
        // Clear the input after processing
        // Use setTimeout to avoid issues with Brave browser on Android
        setTimeout(() => {
          if (e.target) {
            e.target.value = '';
          }
        }, 0);
      } else {
        // Invalid input, clear it
        e.target.value = '';
      }
    } catch (error) {
      console.error('[useMobileInput] Error handling input:', error);
      isProcessingRef.current = false;
      if (e.target) {
        e.target.value = '';
      }
    }
  }, [handleCellInput]);

  const handleMobileKeyDown = useCallback((e) => {
    try {
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        if (!isProcessingRef.current) {
          isProcessingRef.current = true;
          handleCellInput(0).finally(() => {
            isProcessingRef.current = false;
          });
        }
        e.target.value = '';
      } else if (e.key >= '1' && e.key <= '9') {
        // Let the input event handle it (onChange will process)
        // Don't prevent default to allow the input to be entered
      } else if (e.key !== 'Enter' && e.key !== 'Tab') {
        // Prevent other keys
        e.preventDefault();
      }
    } catch (error) {
      console.error('[useMobileInput] Error handling keydown:', error);
      isProcessingRef.current = false;
    }
  }, [handleCellInput]);

  // Blur mobile input when cell is deselected
  useEffect(() => {
    if (isMobile && !selectedCell && mobileInputRef.current) {
      try {
        mobileInputRef.current.blur();
        mobileInputRef.current.value = '';
        isProcessingRef.current = false;
      } catch (error) {
        console.error('[useMobileInput] Error blurring input:', error);
      }
    }
  }, [selectedCell, isMobile]);

  return {
    mobileInputRef,
    handleMobileInput,
    handleMobileKeyDown,
  };
}











