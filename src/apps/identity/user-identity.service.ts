import { Injectable } from "@nestjs/common";
import { UserIdentityProvider } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export interface GitHubUserProfile {
  providerUserId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
}

@Injectable()
export class UserIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveGitHubUser(profile: GitHubUserProfile) {
    const identity = await this.prisma.userIdentity.upsert({
      where: {
        provider_providerUserId: {
          provider: UserIdentityProvider.github,
          providerUserId: profile.providerUserId,
        },
      },
      create: {
        provider: UserIdentityProvider.github,
        providerUserId: profile.providerUserId,
        user: {
          create: {
            email: profile.email,
            name: profile.name,
            imageUrl: profile.imageUrl,
          },
        },
      },
      update: {},
      include: { user: true },
    });

    return identity.user;
  }
}
