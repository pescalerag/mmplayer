type LeaveGuard = (proceed: () => void) => void;
const guards = new Map<symbol, LeaveGuard>();

export function registerDesktopLeaveGuard(guard: LeaveGuard) {
  const id = Symbol();
  guards.set(id, guard);
  return () => { guards.delete(id); };
}

/** The confirmation resumes this exact transition, without prompting twice. */
export function requestDesktopNavigation(proceed: () => void) {
  const guard = [...guards.values()].at(-1);
  if (guard) guard(proceed);
  else proceed();
}
