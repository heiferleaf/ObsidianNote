// Shared with the tracked Quartz build. Run normalizeMathMarkdown on the raw note
// BEFORE extracting $$ pairs; normalizeMath alone cannot recover mis-split prose.
export { normalizeMath, normalizeMathMarkdown } from "../quartz/scripts/math-normalize.mjs"
