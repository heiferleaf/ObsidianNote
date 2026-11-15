/** Only notation-preserving compatibility fixes. Unknown syntax is left unchanged. */
export function normalizeMath(latex) {
  return (
    latex
      .replace(/\u200B/g, "")
      .replace(/\\([QZ])(?![A-Za-z])/g, (_match, set) => `\\mathbb{${set}}`)
      // Here $ names an arbitrary set operation, as explained by the source paragraph.
      .replaceAll("(R$S)^{-1}", "(R\\$S)^{-1}")
      // Avoid a literal dollar character prematurely closing Markdown inline math.
      .replaceAll("\\$", '{\\char"24}')
  )
}

/**
 * Repair Markdown boundaries BEFORE extracting math (including Pages math fences).
 * Code, formula operators, indices, matrix rows, and surrounding prose are preserved.
 */
export function normalizeMathMarkdown(markdown) {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n"
  let source = markdown.replace(/\r\n/g, "\n")
  // This source fence loses its list indentation halfway through the Java class.
  const brokenJava =
    "\t```JAVA\n\t\t// 内存中动态生成，你永远看不到这个文件\nfinal class StreamClass$$Lambda$1 implements Comparator<String> {\n    public int compare(String s1, String s2) {\n        return StreamClass.lambda$test0$0(s1, s2); // 调回那个静态方法\n    }\n}\n\t```"
  const repairedJava = brokenJava.replace(/^\t```JAVA/, "\n```java").replace(/\n\t```$/, "\n```\n")
  source = source.replace(brokenJava, () => repairedJava)
  const tokens = []
  const token = (value) => {
    const key = `\uE100${tokens.length}\uE101`
    tokens.push(value)
    return key
  }
  // Shield fences even when their indentation is malformed; dollar signs in code aren't math.
  const lines = source.split("\n")
  const shielded = []
  for (let index = 0; index < lines.length; index++) {
    const opening = lines[index].match(/^[\t ]*(?:>[\t ]*)*(`{3,}|~{3,})[^`~]*$/)
    if (!opening) {
      shielded.push(lines[index])
      continue
    }
    const fence = opening[1]
    const block = [lines[index]]
    while (++index < lines.length) {
      block.push(lines[index])
      const closing = lines[index].match(/^[\t ]*(?:>[\t ]*)*(`{3,}|~{3,})[\t ]*$/)
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) break
    }
    shielded.push(token(block.join("\n")))
  }
  source = shielded.join("\n").replace(/(`+)([^`\n]*?)\1/g, (code) => token(code))
  // Two neighboring inline delimiters aren't a new display delimiter.
  source = source.replaceAll("$x^T$$x$", "$x^T$ $x$")
  const escaped = (index) => {
    let slashes = 0
    while (source[index - 1 - slashes] === "\\") slashes++
    return slashes % 2 === 1
  }
  const replacements = []
  for (let start = 0; start < source.length - 1; start++) {
    if (!source.startsWith("$$", start) || escaped(start)) continue
    let end = start + 2
    while (end < source.length - 1 && (!source.startsWith("$$", end) || escaped(end))) end++
    if (end >= source.length - 1) break // Unknown unmatched delimiter stays visible.
    const lineStart = source.lastIndexOf("\n", start - 1) + 1
    const lineBefore = source.slice(lineStart, start)
    const quote = lineBefore.match(/^[\t ]*((?:>[\t ]*)+)/)?.[1] ?? ""
    const from = /^[\t >]*$/.test(lineBefore) ? lineStart : start
    const quoteDepth = (quote.match(/>/g) ?? []).length
    const body = source.slice(start + 2, end)
    // Strip only the surrounding quote markers; a leading > inside math is an operator.
    const unquoted = quoteDepth
      ? body.replace(new RegExp(`^(?:[\\t ]*>[\\t ]?){${quoteDepth}}`, "gm"), "")
      : body
    const value = normalizeMath(unquoted.trim())
    const block = ["$$", ...value.split("\n"), "$$"].map((line) => quote + line).join("\n")
    replacements.push({ from, to: end + 2, value: token(`\n${quote}\n${block}\n${quote}\n`) })
    start = end + 1
  }
  for (const change of replacements.reverse())
    source = source.slice(0, change.from) + change.value + source.slice(change.to)
  // Inline formulas receive the same conservative notation fixes.
  const inline = []
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== "$" || source[start + 1] === "$" || escaped(start)) continue
    let end = start + 1
    while (end < source.length && source[end] !== "\n" && (source[end] !== "$" || escaped(end)))
      end++
    if (source[end] !== "$") continue
    inline.push({
      from: start,
      to: end + 1,
      value: `$${normalizeMath(source.slice(start + 1, end))}$`,
    })
    start = end
  }
  for (const change of inline.reverse())
    source = source.slice(0, change.from) + change.value + source.slice(change.to)
  for (let pass = 0; pass < 3 && /\uE100\d+\uE101/.test(source); pass++) {
    source = source.replace(/\uE100(\d+)\uE101/g, (_match, index) => tokens[Number(index)])
  }
  return newline === "\r\n" ? source.replace(/\n/g, newline) : source
}
