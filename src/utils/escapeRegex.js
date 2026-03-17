/**
 * Escape special regex characters in user input to prevent ReDoS attacks.
 * Use this before passing user strings into MongoDB $regex queries.
 */
export const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
