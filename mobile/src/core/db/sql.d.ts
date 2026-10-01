/** .sql files are inlined as strings by babel-plugin-inline-import (see babel.config.js). */
declare module '*.sql' {
  const content: string;
  export default content;
}
