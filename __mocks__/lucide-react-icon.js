/**
 * Mock for lucide-react ESM icons
 *
 * This mock is used because modularizeImports in next.config.js transforms
 * lucide-react barrel imports to individual ESM icon imports like:
 *   lucide-react/dist/esm/icons/check.js
 *
 * Jest cannot parse these ESM files, so we mock them with a simple
 * forwardRef component that renders an SVG placeholder.
 */

const React = require('react');

// Create a mock icon component that matches lucide-react's API
const createMockIcon = (displayName) => {
  const Icon = React.forwardRef((props, ref) => {
    // Build className: combine lucide base class with any passed className
    const lucideClass = `lucide lucide-${displayName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`;
    const combinedClassName = props.className
      ? `${lucideClass} ${props.className}`
      : lucideClass;

    return React.createElement('svg', {
      ref,
      'data-testid': `lucide-${displayName}`,
      'data-lucide': displayName,
      xmlns: 'http://www.w3.org/2000/svg',
      width: props.size || 24,
      height: props.size || 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: props.strokeWidth || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
      className: combinedClassName,
    });
  });
  Icon.displayName = displayName || 'LucideIcon';
  return Icon;
};

// Export default as a mock icon
module.exports = createMockIcon('MockIcon');
module.exports.default = createMockIcon('MockIcon');
