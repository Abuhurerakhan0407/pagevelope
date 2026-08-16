declare module "mjml" {
  export interface MjmlCompilerError {
    line?: number;
    message: string;
    tagName?: string;
    formattedMessage?: string;
  }

  export interface MjmlCompilerOptions {
    validationLevel?: "strict" | "soft" | "skip";
    beautify?: boolean;
    minify?: boolean;
    keepComments?: boolean;
    ignoreIncludes?: boolean;
    useMjmlConfigOptions?: boolean;
  }

  export interface MjmlCompilerResult {
    html: string;
    errors: MjmlCompilerError[];
  }

  export default function mjml2html(
    input: string,
    options?: MjmlCompilerOptions
  ): MjmlCompilerResult | Promise<MjmlCompilerResult>;
}
