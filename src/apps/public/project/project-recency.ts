export const withProjectRecency = <T extends { updatedAt: Date }>(
  project: T,
  now: number = Date.now(),
): T & { isRecent: boolean } => {
  const age = now - project.updatedAt.getTime();
  return { ...project, isRecent: age >= 0 && age <= 7 * 24 * 60 * 60 * 1000 };
};
