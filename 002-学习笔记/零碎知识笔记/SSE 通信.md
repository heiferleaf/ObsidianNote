---
created: 2026-06-27
modified: 2026-08-26
title: SSE 通信
tags:
  - 技术栈
subject: 计算机网络
---

[[HTTP1.0 HTTP1.1 HTTP2.0 HTTP3.0 HTTPS|之前的 HTTP 协议笔记]]

这里我们先对之前的知识体系进行补充

- HTTP1.1 支持更多的缓存机制、请求体压缩、Chunked传输、Ranged传输、携带域名、保持TCP的长连接
	- 长连接的实际含义：应用层想要通过 TCP 传输层发送多个消息，不需要每一次都建立连接
	> 建立连接的本质是在内核态开辟用于发送和接收的缓冲区，维护窗口大小和序列号
	- Chunked 传输
		- 适用于请求/响应中，预先不知道传输的数据大小（请求头的 Content-Length），数据在实时生成（大模型的生成、上传图片）
		- 如果想指定大小，就需要等待数据生成完、准备完，在此之前，不会发送数据，另一方也不会接收数据，因此等待时间很长
		- 所以支持 `Transfer-Encoding: chunked` 请求头字段，请求体的内容格式为 `16进制表示的数据大小 + 对应大小的数据`
			- 通信对方通过请求头知道如何读取、通过长度知道读取多少
			- 长度为0说明传输完了
	> 这也是 流式通信的思想基础

- HTTP2.0 支持请求的多路复用（存在队头阻塞）、请求头的压缩（HPACKS）
	- 有效的数据不再是 请求行 + 请求头 + 请求体，而是 HEADERS + DATA
		- HEADERS 包含了原来请求头的（method+host+url+protocol）信息和请求体信息
			- 请求头压缩的含义为，对于客户端发送请求的 HEADERS，服务器支持缓存，返回一个索引号，后续相同的客户端请求HEADERS，只传输索引号
	- 有效的数据 `!=` 实际传输的数据，2.0中实际传输的数据以 `Frame` 作为单位，Frame 的结构
		- Length
		- Type
		- Flags
		- Stream ID
		- PAYLOAD （放HEADERS / DATA）
	- 之所以支持多路复用，是因为会把一次通信数据数据用 Stream ID 作为标识，从而可以识别一个响应对应于哪一个请求
	> 天然的涵盖了 1.1 的Chunked，Frame就像是一个个的Chunked
	> Flag 为 END 标识说明传输忘了
	> 
> 2.0 的多路复用指一个请求对应的 TCP 连接上，可以并发传输好几个应用层的逻辑流

- SSE 连接
																																	- 在不知道响应数据多少长度的基础上，分为多次返回响应内容，所以依赖于1.1的Chunked或者是2.0的Frame机制
	- 请求方
	```text
	--------HTTP 1.1 的背景下使用SSE -----------
	GET /stream HTTP/1.1
	Host: api.example.com
	Accept: text/event-stream
	Cache-Control: no-cache
	Connection: keep-alive
	User-Agent: Chrome/...
	Accept-Encoding: gzip, deflate
	
	------- HTTP 2.0 的背景下使用SSE -----------
	HEADERS 中包含了 伪首部（原来的请求行） + 请求头信息
	```
	- 响应方（响应的内容叫做事件）
		实际封装在 Chunked / Frame Payload 中的SSE数据格式，键值对，键包含
		- id：一次 SSE 响应数据的标识，用于在客户端更新 Last_ID 字段，重连时发给服务器实现重传
		- event：标记响应事件的类型
		- data：实际数据
		- retry：告诉客户端重连的等待时间（这段时间内没有收到数据尝试重连）
		- ： ，会被客户端忽略，作用是心跳机制
	响应的数据以空行作为标识结束，所以一个响应事件可以有多个 Data

## MCP 服务器中使用 SSE

在 MCP 服务器中，客户端会先和服务器建立 SSE 连接，后续发送的 HTTP POST 请求，都是通过 SSE 来进行响应。
> 最开始建立 SSE 连接，返回 SessionID，后续的 POST 请求会携带 SessionID，从而服务端找到对应的 SSE 连接来响应

为什么这样设计，不是直接让 POST 对应的 TCP 连接中返回实际响应内容
1. SSE 在 MCP服务器 中是必须要建立的
	- 服务端需要先客户端主动通信（通知类型的消息）
2. MCP 通信协议的数据采用 JSON RPC 格式，大致分为服务器原语类型、客户端原语类型、通知、生命周期管理，其中大部分通信数据类型中，都包含 id 字段，所以SSE响应的内容，客户端可以知道对应的哪一个 POST 请求。结论：==SSE 可以正确实现响应功能==
3. SSE 可行，那为什么 POST 响应不可行？
	实际上是可行的，在最新版本的