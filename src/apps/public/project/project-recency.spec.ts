import { withProjectRecency } from "./project-recency";

describe("withProjectRecency", () => {
  it("생성·업데이트 시각부터 정확히 7일까지 최근 표시하고 미래와 7일 초과는 제외한다", () => {
    const now = Date.parse("2026-11-12T00:00:00Z");
    for (const [age, expected] of [
      [0, true],
      [7 * 86400000, true],
      [7 * 86400000 + 1, false],
      [-1, false],
    ] as const) {
      const project = {
        slug: "portfolio-admin",
        order: 13,
        updatedAt: new Date(now - age),
      };
      expect(withProjectRecency(project, now)).toEqual({
        ...project,
        isRecent: expected,
      });
      expect(project).not.toHaveProperty("isRecent");
    }
  });
});
