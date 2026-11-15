import { remark } from "remark"

/** Recover broken containers/EOF fences without flattening complete examples. */
export function normalizeCodeFences(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n"),
    output = []
  const observedCodes = new Map()
  const collect = (node) => {
    if (node.type === "code") observedCodes.set(node.position.start.line, node)
    for (const child of node.children ?? []) collect(child)
  }
  collect(remark().parse(lines.join("\n")))
  for (let i = 0; i < lines.length; i++) {
    const opening = lines[i].match(/^([\t ]*)((?:>[\t ]*)*)(`{3,}|~{3,})([^`~]*)$/)
    if (!opening) {
      output.push(lines[i])
      continue
    }
    const start = i,
      [, indent, quote, fence, language] = opening,
      depth = (quote.match(/>/g) ?? []).length,
      body = []
    // Preserve only a fence that the parser already recognizes as one complete
    // code block. Balanced-looking fences inside indented text are not enough.
    const observed = observedCodes.get(start + 1),
      end = observed ? observed.position.end.line - 1 : -1,
      closing = end > start ? lines[end].match(/^([\t ]*)((?:>[\t ]*)*)(`{3,}|~{3,})[\t ]*$/) : null,
      originalBody = end > start ? lines.slice(start + 1, end) : [],
      consistentBody = originalBody.every((line) => {
        if (!depth && !line.trim()) return true
        if (indent && !line.startsWith(indent)) return false
        return !depth || new RegExp("^(?:>[\\t ]?){" + depth + "}").test(line.slice(indent.length))
      }),
      payload = originalBody.map((line) => {
        let value = indent && line.startsWith(indent) ? line.slice(indent.length) : line
        if (depth) value = value.replace(new RegExp("^(?:>[\\t ]?){" + depth + "}"), "")
        return value
      }).join("\n")
    if (closing && closing[1] === indent && (closing[2].match(/>/g) ?? []).length === depth && closing[3][0] === fence[0] && closing[3].length >= fence.length && consistentBody && observed.value === payload) {
      output.push(...lines.slice(start, end + 1))
      i = end
      continue
    }
    // Keep the existing recovery path for genuinely broken containers/EOF.
    let closed = false
    while (++i < lines.length) {
      const closing = lines[i].match(/^[\t ]*(?:>[\t ]*)*(`{3,}|~{3,})[\t ]*$/)
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        closed = true
        break
      }
      let value = lines[i]
      if (depth) value = value.replace(new RegExp("^[\\t ]*(?:>[\\t ]?){" + depth + "}"), "")
      if (indent && value.startsWith(indent)) value = value.slice(indent.length)
      body.push(value)
    }
    output.push("", fence + language.trim(), ...body, fence, "")
    if (!closed) break
  }
  return output.join("\n")
}
