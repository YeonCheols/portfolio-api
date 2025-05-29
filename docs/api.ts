/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface CreateProjectDto {
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

export type UpdateProjectDto = object;

export interface StatusUpdateDto {
  slug: string;
  isShow: boolean;
}
