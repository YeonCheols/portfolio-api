import { canAdvancePortOnConflict, resolveListenPort } from "./listen-port";

describe("resolveListenPort", () => {
  it("PORT가 있으면 그 포트를 쓴다", () => {
    expect(resolveListenPort("8080")).toBe(8080);
  });

  it("PORT가 없으면 로컬 포트 4001을 쓴다", () => {
    expect(resolveListenPort(undefined)).toBe(4001);
    expect(resolveListenPort("")).toBe(4001);
    expect(resolveListenPort("  ")).toBe(4001);
  });

  it("PORT가 숫자가 아니면 예외를 던진다", () => {
    expect(() => resolveListenPort("abc")).toThrow(/PORT/);
    expect(() => resolveListenPort("0")).toThrow(/PORT/);
  });
});

describe("canAdvancePortOnConflict", () => {
  it("PORT가 지정되면 다음 포트로 넘어가지 않는다", () => {
    expect(canAdvancePortOnConflict("8080")).toBe(false);
  });

  it("PORT가 없으면 로컬에서만 다음 포트로 넘어간다", () => {
    expect(canAdvancePortOnConflict(undefined)).toBe(true);
    expect(canAdvancePortOnConflict("")).toBe(true);
  });
});
