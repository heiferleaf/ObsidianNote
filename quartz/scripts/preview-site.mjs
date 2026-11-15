import http from "node:http"
import path from "node:path"
import { access } from "node:fs/promises"
import serveHandler from "serve-handler"
import { quartzRoot } from "./site-paths.mjs"

const args = process.argv.slice(2)
const portIndex = args.indexOf("--port")
const port = portIndex < 0 ? 8088 : Number(args[portIndex + 1])
const base = "/ObsidianNote"
const output = path.join(quartzRoot, "public")
await access(path.join(output, "index.html"))
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname
  if (pathname === base || pathname === "/") {
    response.writeHead(302, { Location: `${base}/` }).end()
    return
  }
  if (!pathname.startsWith(`${base}/`)) {
    response.writeHead(404).end("Not found")
    return
  }
  request.url = request.url.slice(base.length)
  // Preserve directory slashes, and keep any clean-URL redirect under the site prefix.
  const writeHead = response.writeHead.bind(response)
  response.writeHead = (statusCode, headers) => {
    if (headers?.Location?.startsWith("/")) headers.Location = base + headers.Location
    return writeHead(statusCode, headers)
  }
  serveHandler(request, response, { public: output, cleanUrls: true }).catch((error) => {
    console.error(error)
    response.writeHead(500).end()
  })
})
server.listen(port, "127.0.0.1", () => console.log(`Local: http://127.0.0.1:${port}${base}/`))
