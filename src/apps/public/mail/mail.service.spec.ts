import { InternalServerErrorException } from "@nestjs/common";
import { Resend } from "resend";
import { MailService } from "./mail.service";

const send = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

describe("MailService", () => {
  const originalEnv = { ...process.env };
  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_TO = "owner@test.com";
    delete process.env.MAIL_FROM;
    service = new MailService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("RESEND_API_KEY 환경변수로 Resend 클라이언트를 만든다", () => {
      expect(Resend).toHaveBeenCalledWith("re_test_key");
    });

    it("RESEND_API_KEY가 없어도 생성은 되지만 클라이언트를 만들지 않는다", () => {
      jest.clearAllMocks();
      delete process.env.RESEND_API_KEY;

      expect(() => new MailService()).not.toThrow();
      expect(Resend).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    it("받는 사람을 지정하면 그 주소로 메일을 보낸다", async () => {
      send.mockResolvedValue({ data: { id: "1" }, error: null });

      await expect(
        service.send("user@test.com", "제목", "<p>내용</p>"),
      ).resolves.toEqual({ success: true });
      expect(send).toHaveBeenCalledWith({
        from: "웹사이트 문의 <onboarding@resend.dev>",
        to: "user@test.com",
        subject: "제목",
        html: "<p>내용</p>",
      });
    });

    it("MAIL_FROM이 있으면 보내는 사람으로 사용한다", async () => {
      process.env.MAIL_FROM = "Portfolio <noreply@test.com>";
      service = new MailService();
      send.mockResolvedValue({ data: { id: "1" }, error: null });

      await service.send("user@test.com", "제목", "내용");

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ from: "Portfolio <noreply@test.com>" }),
      );
    });

    it("받는 사람이 없으면 MAIL_TO 주소로 보낸다", async () => {
      send.mockResolvedValue({ data: { id: "1" }, error: null });

      await service.send(undefined, "제목", "내용");

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "owner@test.com" }),
      );
    });

    it("RESEND_API_KEY가 없으면 500 에러를 던지고 메일을 보내지 않는다", async () => {
      delete process.env.RESEND_API_KEY;
      service = new MailService();

      await expect(service.send("a@test.com", "제목", "내용")).rejects.toThrow(
        new InternalServerErrorException("RESEND_API_KEY is not configured"),
      );
      expect(send).not.toHaveBeenCalled();
    });

    it("메일 서비스가 에러 객체를 반환하면 그 메시지로 500 에러를 던진다", async () => {
      send.mockResolvedValue({ data: null, error: { message: "invalid to" } });

      const error = await service
        .send("bad", "제목", "내용")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).toBe("invalid to");
    });

    it("메일 서비스 호출이 실패하면 500 에러를 던진다", async () => {
      send.mockRejectedValue(new Error("network down"));

      await expect(service.send("a@test.com", "제목", "내용")).rejects.toThrow(
        new InternalServerErrorException("network down"),
      );
    });
  });
});
