/**
 * Strict Serializer to prevent float truncation bugs.
 * Guarantees that metrics like 0.20 SEC don't accidentally become 0.
 *
 * @param {number|string} value - The raw value to format
 * @param {number} decimals - Precision level
 * @returns {string} - Safely formatted float string
 */
export const formatFloat = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return (0).toFixed(decimals);
  }
  return parseFloat(value).toFixed(decimals);
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
