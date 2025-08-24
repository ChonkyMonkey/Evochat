import { Parser } from 'expr-eval';

/**
 * Evaluates a mathematical expression provided as a string and returns the result.
 *
 * If the input is already a number, it returns the number as is.
 * If the input is not a string or contains invalid characters, an error is thrown.
 * If the evaluated result is not a number, an error is thrown.
 *
 * @param str - The mathematical expression to evaluate, or a number.
 * @param fallbackValue - The default value to return if the input is not a string or number, or if the evaluated result is not a number.
 *
 * @returns The result of the evaluated expression or the input number.
 *
 * @throws Throws an error if the input is not a string or number, contains invalid characters, or does not evaluate to a number.
 */
export function math(str: string | number, fallbackValue?: number): number {
  const hasFallback = typeof fallbackValue === 'number';

  if (typeof str === 'number') {
    return str;
  }

  if (typeof str !== 'string') {
    if (hasFallback) return fallbackValue as number;
    throw new Error(`str is ${typeof str}, but should be a string or number`);
  }

  try {
    const parser = new Parser();
    const value = parser.evaluate(str);

    if (typeof value !== 'number' || !isFinite(value)) {
      if (hasFallback) return fallbackValue as number;
      throw new Error('[math] did not evaluate to a valid number');
    }

    return value;
  } catch (err) {
    if (hasFallback) return fallbackValue as number;
    throw new Error(`[math] invalid expression: ${err}`);
  }
}