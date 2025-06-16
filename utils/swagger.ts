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
  // 배포 환경별 path 설정
  const buildPath =
    process.env.NODE_ENV === "dev" || process.env.NODE_ENV === "prd"
      ? "swagger-static"
      : "api";

  SwaggerModule.setup("api", app, document, {
    ...swaggerCustomOptions,
    customJs: [
      `../${buildPath}/swagger-ui-bundle.js`,
      `../${buildPath}/swagger-ui-standalone-preset.js`,
      `../${buildPath}/swagger-ui-init.js`,
      `../${buildPath}/swagger-ui.js`,
      `../${buildPath}/swagger-ui-es-bundle-core.js`,
      `../${buildPath}/swagger-ui-es-bundle.js`,
    ],
    customCssUrl: `../${buildPath}/swagger-ui.css`,
  });
  expressApp.use(
    `/${buildPath}`,
    express.static(join(__dirname, "..", buildPath)),
  );
}
