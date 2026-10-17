import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("rootController", () => {
    it("루트 경로로 요청하면 403 not allowed url 응답을 반환한다", () => {
      expect(appController.rootController()).toEqual({
        status: 403,
        message: "not allowed url",
      });
    });
  });
});
