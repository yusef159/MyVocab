type Axis = 'horizontal' | 'vertical' | null;

// Lock the initial gesture direction so later finger drift cannot change its intent.
export function createFlashcardSwipe() {
  let start: { x: number; y: number } | null = null;
  let axis: Axis = null;
  let deltaX = 0;

  const cancel = () => { start = null; axis = null; deltaX = 0; };
  const move = (x: number, y: number) => {
    if (!start) return { axis: null, offset: 0 };
    deltaX = x - start.x;
    const deltaY = y - start.y;
    if (!axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 6) {
      axis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
    return {
      axis,
      offset: axis === 'horizontal' ? Math.max(-160, Math.min(160, deltaX)) : 0,
    };
  };

  return {
    start(x: number, y: number) { start = { x, y }; axis = null; deltaX = 0; },
    move,
    finish(x: number, y: number): 'known' | 'problem' | null {
      move(x, y);
      const answer = axis === 'horizontal' && Math.abs(deltaX) >= 70
        ? deltaX > 0 ? 'known' : 'problem'
        : null;
      cancel();
      return answer;
    },
    cancel,
  };
}
