---
created: 2026-03-03
modified: 2026-03-03
---


Singleton 单例

> 默认的 scope 作用域就是单例，容器中管理唯一的 Bean 对象，每一次获取 Bean，或者注入 Bean，都是相同的对象
> 对应的注解是 @Scope("singleton")

Prototype 原型

> 每一次申请从容器中获取Bean，或者注入Bean,都是把容器中的Bean作为一个原型，提供一个独立的副本
> 对应的注解是 @Scope("prototype")


Request 请求

> Bean 的生命周期和 Request 一样。当一个新的请求到来时，将容器中原来的 Bean 销毁，创建一个新的 Bean
> 可以通过 @RequestScope 或者 xml中 scope="request" 配置

Session 请求

> Bean 的生命周期和 Session 一样，当服务器中的请求，发现Session过期了之后，容器内部的Bean销毁，然后创建新的
> 可以通过 @SessionScope 或者 scope=“session” 配置

Global Session
>知道有这个概念就行

》》

对于后三者，都是在 Web容器，或者说 Web应用的环境中，才会出现，但其实用的很少