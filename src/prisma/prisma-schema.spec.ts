import * as fs from "fs";
import * as path from "path";

const schema = fs.readFileSync(
  path.join(__dirname, "..", "..", "prisma", "schema.prisma"),
  "utf8",
);

const clientGenerators = [
  ...schema.matchAll(/generator\s+(\w+)\s*\{([^}]*)\}/g),
].filter(([, , body]) => /provider\s*=\s*"prisma-client-js"/.test(body));

describe("prisma/schema.prisma", () => {
  it("@prisma/client가 실행 시 읽는 기본 위치에 클라이언트를 생성한다", () => {
    const defaultOutput = clientGenerators.filter(
      ([, , body]) => !/^\s*output\s*=/m.test(body),
    );

    expect(defaultOutput.map(([, name]) => name)).toEqual(["client"]);
  });

  it("심볼릭 링크를 따라가지 않는 타입 검사를 위해 루트 node_modules에도 생성한다", () => {
    const rootOutput = clientGenerators.filter(([, , body]) =>
      /^\s*output\s*=\s*"\.\.\/node_modules\/\.prisma\/client"/m.test(body),
    );

    expect(rootOutput).toHaveLength(1);
  });
});
