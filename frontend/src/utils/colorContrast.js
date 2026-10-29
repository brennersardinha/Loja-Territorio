const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function relativeLuminance(hex) {
  if (!HEX_COLOR.test(hex || '')) return null;
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === null || b === null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function accessibleForeground(background) {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#111827') ? '#ffffff' : '#111827';
}

export function validateThemeContrast(colors) {
  const textRatio = contrastRatio(colors?.secondary, colors?.background);
  const actionRatio = contrastRatio(colors?.primary, colors?.background);
  return {
    textRatio,
    actionRatio,
    valid: textRatio >= 4.5 && actionRatio >= 3,
    errors: [
      ...(textRatio < 4.5 ? ['O contraste entre texto e fundo deve ser de pelo menos 4,5:1.'] : []),
      ...(actionRatio < 3 ? ['O contraste entre a cor de ação e o fundo deve ser de pelo menos 3:1.'] : []),
    ],
  };
}
