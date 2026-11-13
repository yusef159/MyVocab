export type ReviewAnswer = 'known' | 'problem';
export interface PendingReview { wordId: string; result: ReviewAnswer; id: string }

// getRandomValues also works on private-network HTTP origins.
export function newReviewId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join('-');
}

export function createReviewSubmission() {
  let busy = false;
  let pending: PendingReview | null = null;
  return async (wordId: string, result: ReviewAnswer,
    save: (review: PendingReview) => Promise<boolean>,
    advance: (result: ReviewAnswer) => void): Promise<boolean> => {
    if (busy) return false;
    busy = true;
    pending = pending?.wordId === wordId ? pending : { wordId, result, id: newReviewId() };
    try {
      if (!await save(pending)) return false;
      const savedResult = pending.result;
      pending = null;
      advance(savedResult);
      return true;
    } finally { busy = false; }
  };
}
