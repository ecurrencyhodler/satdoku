import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook for handling mobile input
 */
export function useMobileInput(isMobile, selectedCell, handleCellInput) {
  const mobileInputRef = useRef(null);

  const handleMobileInput = useCallback((e) => {
    const value = e.target.value;
    if (value === '') {
      handleCellInput(0);
      return;
    }
    
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      handleCellInput(num);
      // Clear the input after processing
      e.target.value = '';
    } else {
      // Invalid input, clear it
      e.target.value = '';
    }
  }, [handleCellInput]);

  const handleMobileKeyDown = useCallback((e) => {
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      handleCellInput(0);
      e.target.value = '';
    } else if (e.key >= '1' && e.key <= '9') {
      // Let the input event handle it
    } else if (e.key !== 'Enter' && e.key !== 'Tab') {
      // Prevent other keys
      e.preventDefault();
    }
  }, [handleCellInput]);

  // Blur mobile input when cell is deselected
  useEffect(() => {
    if (isMobile && !selectedCell && mobileInputRef.current) {
      mobileInputRef.current.blur();
      mobileInputRef.current.value = '';
    }
  }, [selectedCell, isMobile]);

  return {
    mobileInputRef,
    handleMobileInput,
    handleMobileKeyDown,
  };
}
