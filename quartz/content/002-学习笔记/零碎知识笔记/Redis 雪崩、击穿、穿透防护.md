---
created: 2026-03-11
modified: 2026-03-11
---

## 概念回顾

- 雪崩：Redis缓存中有大量数据同时过期，导致一时间DB承受过多的流程，响应时间长
- 击穿：Redis中的热点数据过期，导致大流量落到DB层
- 穿透：在Redis和DB中都不存在的数据被请求，导致每一次请求都会到DB层

## 解决方案

- 雪崩：Redis缓存中的数据设计随机的过期时间
- 击穿：写Redis缓存设计锁，后续请求还是由Redis进行处理
- 穿透：设置空值，让后续的请求被Redis拦截；设置布隆过滤器

## 代码流程

```java

String key = ... // 构建访问数据缓存的key
Object value = redisTemplate.opsForValue().get(key);
// 通过空值的设置，防止穿透
if(NULL_VALUE.equals(value)) {
	return null;
}
if(value != null) {
	return value;
}
// 缓存没有命中
if(value == null) {
	// 防止击穿，需要准备锁
	String lockKey = ...
	if(Boolean.TURE.equals(redisTemplate.opsForValue().get(lockKey, 等待时间， 时间单位))) // 等待一段时间的目的是让原生的Redis锁操作能起到类似的阻塞效果，而不是直接失败返回 {
		// 双重检查，因为可能有多个线程进入到缓存没有命中的逻辑，只有第一个线程可以写回缓存数据
		value = redisTemplate.opsForValue().get(key);
		// 通过空值的设置，防止穿透
		if(NULL_VALUE.equals(value)) {
			return null;
		}
		if(value != null) {
			return value;
		}
		// 将数据写回缓存的进程
		Object result = mapper.xxx();
		// 通过随机的过期时间，防止雪崩
		redisTemplate.opsForValue().set(key, result, 随机的过期时间， 时间单位)；
		return result;
	} else {
		// 通过递归重试
		try {
			Thread.sleep(500);
		} catch(InterruptException e) {
			// 打印日志
			Thread.currentThread().interrupt();
		}
		return // 递归调用
	}
}
```