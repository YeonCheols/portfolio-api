import { PATH_METADATA } from "@nestjs/common/constants";

import { OAuthMetadataController } from "./oauth-metadata.controller";

describe("OAuthMetadataController", () => {
  it("path가 있는 issuer의 RFC 8414 well-known 경로에서 metadata를 제공한다", () => {
    const metadata = { issuer: "https://api.example.com/auth" };
    const service = { getOAuthMetadata: jest.fn().mockReturnValue(metadata) };
    const controller = new OAuthMetadataController(service as never);

    expect(controller.oauthMetadata()).toEqual(metadata);
    const routeHandler = Object.getOwnPropertyDescriptor(
      OAuthMetadataController.prototype,
      "oauthMetadata",
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe(
      ".well-known/oauth-authorization-server/auth",
    );
    expect(service.getOAuthMetadata).toHaveBeenCalledTimes(1);
  });
});
