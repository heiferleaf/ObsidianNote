---
created: 2026-03-20
modified: 2026-03-20
---
## 元注解

注解注解的注解。
- @Target
- @Retention
- @Repeatable
- @Inherited

@Inherited 注解
	被 Inherited 注解的注解，需要注解 `@Target(ELEMENTTYPE.TYPE)`。
	也就是说，**针对的是注解在类上的注解**
	类A上有注解 I，I上有注解@Inherited。对于类A来说，其子类会继承类A的所有注解

@Retention
	默认的策略是 CLASS：注解保留在编译后的字节码文件中
	其他策略有：SOURCE，注解只有源代码能看，RUNTIME，注解在运行时保留
