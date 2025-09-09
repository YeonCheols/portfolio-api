import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { MailService } from "./mail.service";
import { SendMailRequest, SendMailResponse } from "./dto";

@ApiTags("mail")
@Controller("mail")
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @ApiOperation({ summary: "메일 발송" })
  @ApiOkResponse({ description: "메일 발송 성공", type: SendMailResponse })
  @ApiBody({ type: SendMailRequest })
  @Post("send")
  async send(@Body() body: SendMailRequest) {
    const { email, subject, content } = body;
    await this.mailService.send(email, subject, content);
    return { success: true } as SendMailResponse;
  }
}
