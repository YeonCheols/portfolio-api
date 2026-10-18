import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import { setupSwagger } from "../utils/swagger";
import { bootstrap, startIfDirect } from "./main";

jest.mock("./app.module", () => ({
  AppModule: class AppModule {},
}));

jest.mock("@nestjs/core", () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock("../utils/swagger", () => ({
  setupSwagger: jest.fn(),
}));

const listen = jest.fn();
const enableCors = jest.fn();
const enableShutdownHooks = jest.fn();
const app = {
  listen,
  enableCors,
  get: jest.fn(() => ({ enableShutdownHooks })),
};

describe("bootstrap", () => {
  const originalPort = process.env.PORT;

  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.clearAllMocks();
    delete process.env.PORT;
    listen.mockResolvedValue(undefined);
    enableShutdownHooks.mockResolvedValue(undefined);
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it("인증서가 없으면 HTTP로 앱을 만들고 4001에서 listen 한다", async () => {
    await bootstrap();

    const createCalls = (NestFactory.create as jest.Mock).mock
      .calls as unknown[][];
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toHaveLength(1);
    expect(listen).toHaveBeenCalledWith(4001);
    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.arrayContaining([
          "https://www.ycseng.com",
          "https://admin.ycseng.com",
        ]),
        credentials: true,
      }),
    );
    expect(setupSwagger).toHaveBeenCalledWith(app);
    expect(enableShutdownHooks).toHaveBeenCalledWith(app);
  });

  it("인증서가 있으면 HTTPS 옵션으로 앱을 만든다", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((path: string) =>
      Buffer.from(path),
    );

    await bootstrap();

    const readCalls = (fs.readFileSync as jest.Mock).mock.calls as string[][];
    expect(readCalls).toEqual([
      ["./cert/local.ycseng.com-key.pem"],
      ["./cert/local.ycseng.com.pem"],
    ]);
    const createCalls = (NestFactory.create as jest.Mock).mock
      .calls as unknown[][];
    expect(createCalls[0]?.[1]).toEqual({
      httpsOptions: {
        key: Buffer.from("./cert/local.ycseng.com-key.pem"),
        cert: Buffer.from("./cert/local.ycseng.com.pem"),
      },
    });
  });

  it("PORT가 있으면 그 포트에서 listen 한다", async () => {
    process.env.PORT = "8080";

    await bootstrap();

    expect(listen).toHaveBeenCalledWith(8080);
  });

  it("PORT가 없을 때 포트가 사용 중이면 다음 포트로 listen 한다", async () => {
    const error = Object.assign(new Error("in use"), { code: "EADDRINUSE" });
    listen.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

    await bootstrap();

    expect(listen).toHaveBeenNthCalledWith(1, 4001);
    expect(listen).toHaveBeenNthCalledWith(2, 4002);
  });

  it("PORT가 지정된 상태에서 포트가 사용 중이면 예외를 던진다", async () => {
    process.env.PORT = "8080";
    const error = Object.assign(new Error("in use"), { code: "EADDRINUSE" });
    listen.mockRejectedValueOnce(error);

    await expect(bootstrap()).rejects.toBe(error);
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it("직접 실행이면 서버를 시작한다", async () => {
    const current = module;

    await startIfDirect(current, current);

    expect(listen).toHaveBeenCalledWith(4001);
  });

  it("직접 실행이 아니면 서버를 시작하지 않는다", async () => {
    await startIfDirect(module, {} as NodeJS.Module);

    expect(listen).not.toHaveBeenCalled();
  });

  it("포트 충돌이 아닌 listen 오류는 그대로 던진다", async () => {
    const error = Object.assign(new Error("denied"), { code: "EACCES" });
    listen.mockRejectedValueOnce(error);

    await expect(bootstrap()).rejects.toBe(error);
    expect(listen).toHaveBeenCalledTimes(1);
  });
});
