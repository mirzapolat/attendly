// Privacy helpers for masking attendee info in shared views.
export const maskName = (fullName: string): string => {
  const safeName = typeof fullName === 'string' ? fullName : '';
  const trimmed = safeName.trim();
  if (!trimmed) return safeName;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return safeName;
  const firstName = parts[0];
  const maskPart = (part: string, revealFirst: boolean): string => {
    if (!part) return part;
    if (!revealFirst) {
      return '•'.repeat(part.length);
    }
    const firstAlphaIndex = part.search(/[A-Za-z0-9]/);
    if (firstAlphaIndex === -1) {
      return '•'.repeat(part.length);
    }
    if (firstAlphaIndex === 0) {
      return part[0] + '•'.repeat(Math.max(0, part.length - 1));
    }
    return (
      '•'.repeat(firstAlphaIndex) +
      part[firstAlphaIndex] +
      '•'.repeat(Math.max(0, part.length - firstAlphaIndex - 1))
    );
  };
  if (parts.length === 2) {
    const maskedLast = maskPart(parts[1], true);
    return `${firstName} ${maskedLast}`;
  }
  const secondMasked = maskPart(parts[1], true);
  const hiddenTail = parts.slice(2).map((part) => maskPart(part, false)).join('');
  return `${firstName} ${secondMasked}${hiddenTail}`;
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local[0] + '•'.repeat(Math.max(0, local.length - 1));
  return `${maskedLocal}@${domain}`;
};
