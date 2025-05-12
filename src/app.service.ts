import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  rootController() {
    return { status: 403, message: "not allowed url" };
  }
}
