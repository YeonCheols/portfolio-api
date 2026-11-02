import { Test } from "@nestjs/testing";
import { PrismaService } from "src/prisma/prisma.service";
import { UserIdentityService } from "./user-identity.service";

describe("UserIdentityService", () => {
  const prisma = {
    userIdentity: {
      upsert: jest.fn(),
    },
  };
  const commonUser = {
    id: 1,
    email: "person@example.com",
    name: "Portfolio User",
    imageUrl: "https://example.com/avatar.png",
  };
  const githubProfile = {
    providerUserId: "github-123",
    email: commonUser.email,
    name: commonUser.name,
    imageUrl: commonUser.imageUrl,
  };
  let service: UserIdentityService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.userIdentity.upsert.mockResolvedValue({ user: commonUser });
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserIdentityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(UserIdentityService);
  });

  it("같은 GitHub 식별자는 같은 공용 사용자로 연결한다", async () => {
    const firstLogin = await service.resolveGitHubUser(githubProfile);
    const repeatedLogin = await service.resolveGitHubUser(githubProfile);

    const expectedUpsert = {
      where: {
        provider_providerUserId: {
          provider: "github",
          providerUserId: githubProfile.providerUserId,
        },
      },
      create: {
        provider: "github",
        providerUserId: githubProfile.providerUserId,
        user: {
          create: {
            email: githubProfile.email,
            name: githubProfile.name,
            imageUrl: githubProfile.imageUrl,
          },
        },
      },
      update: {},
      include: { user: true },
    };

    expect(prisma.userIdentity.upsert).toHaveBeenNthCalledWith(
      1,
      expectedUpsert,
    );
    expect(prisma.userIdentity.upsert).toHaveBeenNthCalledWith(
      2,
      expectedUpsert,
    );
    expect(firstLogin).toBe(commonUser);
    expect(repeatedLogin).toBe(commonUser);
  });
});
