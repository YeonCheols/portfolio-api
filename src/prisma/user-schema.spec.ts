import { Prisma } from "@prisma/client";

describe("공용 사용자 Prisma 모델", () => {
  const models = Prisma.dmmf.datamodel.models;
  const user = models.find((model) => model.name === "User");
  const identity = models.find((model) => model.name === "UserIdentity");

  it("공용 사용자 프로필과 로그인 식별자 관계를 제공한다", () => {
    expect(user).toBeDefined();
    expect(user?.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining([
        "id",
        "email",
        "name",
        "imageUrl",
        "identities",
        "createdAt",
        "updatedAt",
      ]),
    );
    expect(
      identity?.fields.find((field) => field.name === "user")?.relationToFields,
    ).toEqual(["id"]);
    expect(
      identity?.fields.find((field) => field.name === "user")
        ?.relationFromFields,
    ).toEqual(["userId"]);
  });

  it("외부 로그인 제공자와 식별자 조합을 유일하게 보장한다", () => {
    expect(identity).toBeDefined();
    expect(identity?.uniqueFields).toContainEqual([
      "provider",
      "providerUserId",
    ]);
  });
});
