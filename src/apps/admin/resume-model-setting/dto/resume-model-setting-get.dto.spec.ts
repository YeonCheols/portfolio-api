import { AdminResumeModelSettingController } from "src/apps/admin/resume-model-setting/resume-model-setting.controller";
import { McpResumeModelSettingController } from "src/apps/mcp/resume-model-setting/mcp-resume-model-setting.controller";
import {
  AdminResumeModelSettingListItemResponse,
  AdminResumeModelSettingResponse,
} from "./resume-model-setting-get.dto";

const swaggerProperties = (type: { prototype: object }): string[] =>
  (
    (Reflect.getMetadata("swagger/apiModelPropertiesArray", type.prototype) as
      | string[]
      | undefined) ?? []
  ).map((name) => name.replace(/^:/, ""));

// 메서드를 직접 참조하지 않고 Swagger 메타데이터가 붙은 함수 객체를 꺼낸다
const findAllHandler = (controller: { prototype: object }): object =>
  Object.getOwnPropertyDescriptor(controller.prototype, "findAll")
    ?.value as object;

const listResponse = (handler: object) => {
  const { type, isArray } = (
    Reflect.getMetadata("swagger/apiResponse", handler) as Record<
      number,
      { type?: unknown; isArray?: boolean }
    >
  )[200];
  return { type, isArray };
};

describe("모델 설정 목록 응답 문서", () => {
  it("목록 항목 응답은 apiKey를 선언하고 단건 응답은 선언하지 않는다", () => {
    expect(
      swaggerProperties(AdminResumeModelSettingListItemResponse),
    ).toContain("apiKey");
    expect(
      swaggerProperties(AdminResumeModelSettingListItemResponse),
    ).toContain("hasApiKey");
    expect(swaggerProperties(AdminResumeModelSettingResponse)).not.toContain(
      "apiKey",
    );
  });

  it("서비스 토큰 목록과 관리자 목록 모두 목록 항목 응답 문서를 쓴다", () => {
    const expected = {
      type: AdminResumeModelSettingListItemResponse,
      isArray: true,
    };
    expect(
      listResponse(findAllHandler(McpResumeModelSettingController)),
    ).toEqual(expected);
    expect(
      listResponse(findAllHandler(AdminResumeModelSettingController)),
    ).toEqual(expected);
  });
});
