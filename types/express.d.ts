import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Query {
    [key: string]: string | undefined;
  }
}