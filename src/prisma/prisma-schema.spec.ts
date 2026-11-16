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

describe("프로젝트 출처 스키마", () => {
  it("기존 회사 프로젝트 세 개만 company로 분류하고 콘텐츠 수정 시각은 건드리지 않는다", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../../prisma/migrations/20261116003404_add_project_source/migration.sql",
      ),
      "utf8",
    );
    const update = migration.match(
      /UPDATE "Project"\s+SET "source" = 'company'\s+WHERE "slug" IN \(([\s\S]*?)\);/,
    );
    expect(update).not.toBeNull();
    expect(
      [...(update?.[1] ?? "").matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .sort(),
    ).toEqual(["albamon", "albamon-deeplink-library", "jobkorea-bizcenter"]);
    expect(migration).not.toContain('"updatedAt"');
    expect(migration).toContain(`NOT NULL DEFAULT 'personal'`);
  });
  it("출처를 personal과 company로 제한하고 기본값을 personal로 둔다", () => {
    const project = schema.match(/model Project\s*\{([\s\S]*?)\}/)?.[1];
    const source = schema.match(/enum ProjectSource\s*\{([\s\S]*?)\}/)?.[1];
    expect(project).toMatch(/source\s+ProjectSource\s+@default\(personal\)/);
    expect(source?.trim().split(/\s+/).sort()).toEqual(["company", "personal"]);
  });
});
