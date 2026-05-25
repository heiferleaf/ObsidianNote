---
title: HTTP 和 HTTPS 的区别
created: 2025-12-24 20:13
modified: 2025-12-28 12:53
tags: [技术栈, 计算机网络]
subject: 计算机网络
---
1. 端口号：HTTP使用80端口，HTTPS使用443端口
2. URL前缀：HTTP的URL前缀时`HTTP://`,HTTPS的前缀是`HTTPS://`
3. 安全性和性能消耗：HTTP工作在TCP协议上，传输明文内容，不进行加密，客户端和服务器端无法验证对方的身份；HTTPS工作在SSL/TLS协议，这两者工作在TCP协议，传输内容采用对称加密，对称加密的密钥用服务器的证书非对称加密。所以说，HTTP 安全性没有 HTTPS 高，但是 HTTPS 比 HTTP 耗费更多服务器资源。
4. SEO：搜索引擎优化，现在的搜索引擎，更青睐使用HTTPS的服务器，搜索结果会优先展示