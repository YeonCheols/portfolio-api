import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Resend } from "resend";

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly defaultFrom: string;
  private readonly defaultTo: string;

  constructor() {
    const apiKey = "re_2iUe2vj4_Nnn2thUfmxEmnNhsrs7ThvF1";
    this.defaultFrom = "웹사이트 문의 <onboarding@resend.dev>";
    this.defaultTo = process.env.MAIL_TO || "s9292909@gmail.com";
    this.resend = new Resend(apiKey);
  }

  async send(to: string | undefined, subject: string, content: string) {
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
        const message =
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
