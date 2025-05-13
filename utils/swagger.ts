/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as express from "express";
import { join } from "path";
import { INestApplication } from "@nestjs/common";
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerCustomOptions,
} from "@nestjs/swagger";

//웹 페이지를 새로고침을 해도 Token 값 유지
const swaggerCustomOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
  },
};

/**
 * @author Ryan
 * @description Swagger 세팅
 */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle("포트폴리오")
    .setDescription("포트폴리오 Swagger API 서버")
    .setVersion("1.0.0")
    //JWT 토큰 설정
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        name: "JWT",
        in: "header",
      },
      "access-token",
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  const expressApp = app.getHttpAdapter().getInstance();

  SwaggerModule.setup("api", app, document, {
    ...swaggerCustomOptions,
    customJs: "../swagger-static/swagger-ui-bundle.js",
    customCssUrl: "../swagger-static/swagger-ui.css",
  });
  expressApp.use(
    "/swagger-static",
    express.static(join(__dirname, "..", "swagger-static")),
  );
}
