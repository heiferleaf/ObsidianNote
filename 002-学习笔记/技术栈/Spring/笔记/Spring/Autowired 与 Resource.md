---
created: 2026-03-03
modified: 2026-03-03
---

Autowired 默认通过 Bean 的类型注入，当存在多个符合的类型时，会按照字段名进行匹配，如果不存在唯一的Bean会报错；搭配Qualifier可以通过名称注入



Resource 内部配有name 和type 的属性。

	配置 name 属性
		1. 按照name的值来匹配名称
		2. 不会按照类型来

	未配置 name 属性
		3. 按照注解的字段或者set的属性名来匹配
		4. 按照类型来匹配
