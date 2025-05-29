export class CreateProjectDto {
  slug: string;
  title: string;
  description: string;
  image: string;
  stacks: string;
  content?: string;
  link_demo?: string;
  link_github?: string;
  is_show?: boolean;
}
