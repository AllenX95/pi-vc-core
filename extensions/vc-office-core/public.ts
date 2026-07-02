export {
  documentParse,
  inspectOfficeEnvironment,
  officeConvert,
  officeDiff,
  officeInspect,
  officePatch,
  officeRead,
  officeRender,
} from "./internal/core.js";
export type {
  ConvertResult,
  DiffResult,
  DocumentBlock,
  DocumentObject,
  OfficeReadResult,
  PatchObject,
  PatchResult,
  RenderResult,
} from "./schema.js";
