/**
 * Replaces {placeholder} tokens in a message template with values from params.
 * If a key is missing from params, the placeholder is left as-is (visible in
 * manual testing, rather than silently rendering blank).
 *
 * @param {string} template - message template, e.g. 'Game not found: {gameId}'
 * @param {Record<string, string|number>} [params] - values to interpolate
 * @returns {string}
 */
export function formatMessage(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : `{${key}}`
  );
}
