export class CreateProjectDto {
  slug: string;
  title: string;
  description: string;
  image: string;
  stacks: string;
  content?: string;
  linkEmo?: string;
  linkGithub?: string;
  isShow?: boolean;
}
