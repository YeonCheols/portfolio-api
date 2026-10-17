import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Resend } from "resend";

@Injectable()
export class MailService {
  private readonly resend: Resend | null;
  private readonly defaultFrom: string;
  private readonly defaultTo: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.defaultFrom =
      process.env.MAIL_FROM || "웹사이트 문의 <onboarding@resend.dev>";
    this.defaultTo = process.env.MAIL_TO || "s9292909@gmail.com";
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async send(to: string | undefined, subject: string, content: string) {
    if (!this.resend) {
      throw new InternalServerErrorException(
        "RESEND_API_KEY is not configured",
      );
    }
    const finalTo = to || this.defaultTo;
    try {
      const result = await this.resend.emails.send({
        from: this.defaultFrom,
        to: finalTo,
        subject,
        html: content,
      });
      const providerError = (result as any)?.error;
      if (providerError) {
        const message: string =
          typeof providerError?.message === "string"
            ? providerError.message
            : typeof providerError === "string"
              ? providerError
              : JSON.stringify(providerError);
        throw new Error(message || "send failed");
      }
      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Mail send failed";
      throw new InternalServerErrorException(message);
    }
  }
}
